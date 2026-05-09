const User = require('../models/User');
const Raffle = require('../models/Raffle');
const Ticket = require('../models/Ticket');

// Configuración de la Racha Diaria (Ej: 5 SP diarios constante)
const STREAK_REWARDS = [5, 5, 5, 5, 5, 5, 5]; 

exports.getRewardsZone = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        const now = new Date();
        const todayStr = now.toDateString();
        const lastLoginStr = user.lastLoginDate ? user.lastLoginDate.toDateString() : null;

        let justReceivedStreak = false;
        let streakReward = 0;

        // Lógica de Racha Diaria
        if (lastLoginStr !== todayStr) {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);

            if (lastLoginStr === yesterday.toDateString()) {
                // Entró ayer, la racha continúa
                user.streakDays += 1;
            } else {
                // Faltó ayer o es su primer día, se reinicia la racha a 1
                user.streakDays = 1;
            }

            // Calcular recompensa (Si pasa de 7, vuelve al ciclo de 7)
            const rewardIndex = (user.streakDays - 1) % 7;
            streakReward = STREAK_REWARDS[rewardIndex];

            // Sumar créditos y actualizar fecha
            user.credits += streakReward;
            user.lastLoginDate = now;
            await user.save();

            justReceivedStreak = true;
        }

        // Verificar estado de juegos (Reinicio a medianoche)
        const canSpinWheel = !user.lastFreeSpin || user.lastFreeSpin.toDateString() !== todayStr || user.role === 'admin';
        const canOpenChest = !user.lastMysteryChest || user.lastMysteryChest.toDateString() !== todayStr || user.role === 'admin';

        // Tiempos restantes (solo si no es admin)
        let timeToNextSpin = "24h";
        if (user.lastFreeSpin && user.role !== 'admin') {
            const next = new Date(user.lastFreeSpin.getTime() + 24 * 60 * 60 * 1000);
            const diff = next - now;
            if (diff > 0) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                timeToNextSpin = `${hours}h ${mins}m`;
            }
        }

        let timeToNextChest = "24h";
        if (user.lastMysteryChest && user.role !== 'admin') {
            const next = new Date(user.lastMysteryChest.getTime() + 24 * 60 * 60 * 1000);
            const diff = next - now;
            if (diff > 0) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                timeToNextChest = `${hours}h ${mins}m`;
            }
        }

        const activeRaffles = await Raffle.find({ status: 'active' });

        res.render('rewards', {
            title: 'Zona de Recompensas',
            user,
            activeRaffles,
            canSpinWheel,
            timeToNextSpin,
            canOpenChest,
            timeToNextChest,
            justReceivedStreak,
            streakReward,
            error: null,
            success: null
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar la zona de recompensas');
    }
};

exports.spinWheel = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const now = new Date();

        // Validar que no haya girado hoy (Ignorar si es ADMIN para pruebas)
        if (user.role !== 'admin' && user.lastFreeSpin) {
            if (user.lastFreeSpin.toDateString() === now.toDateString()) {
                return res.status(400).json({ error: 'Ya usaste tu giro de hoy. Vuelve mañana.' });
            }
        }

        let prize = 0;
        let label = '';
        let gotExtraSpin = false;

        // Lógica "Scripted" pedida por el usuario:
        // 4 veces "Giro Extra" y la 5ta vez "+5 Créditos"
        if (user.consecutiveExtraSpins < 4) {
            prize = 0;
            label = 'EXTRA';
            gotExtraSpin = true;
            user.consecutiveExtraSpins += 1;
        } else {
            prize = 5;
            label = '+5 SP';
            gotExtraSpin = false;
            user.consecutiveExtraSpins = 0; // Reiniciar contador
            user.lastFreeSpin = now; // Ahora sí consume el giro diario
        }

        // Actualizar base de datos
        user.credits += prize;
        await user.save();

        res.json({ prize, label, newBalance: user.credits, gotExtraSpin });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al girar la ruleta.' });
    }
};

// COFRE MISTERIOSO (Cada 24h gratis)
exports.openMysteryChest = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const now = new Date();

        // Admin bypass
        if (user.role !== 'admin' && user.lastMysteryChest) {
            if (user.lastMysteryChest.toDateString() === now.toDateString()) {
                return res.status(400).json({ error: 'Ya abriste tu cofre de hoy. Vuelve mañana.' });
            }
        }

        // Premios cofre: Máximo 12 créditos
        const prizes = [2, 4, 5, 6, 8, 10, 12];
        const prize = prizes[Math.floor(Math.random() * prizes.length)];

        user.credits += prize;
        user.lastMysteryChest = now;
        await user.save();

        res.json({ prize, newBalance: user.credits });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al abrir el cofre.' });
    }
};

// CAJA MISTERIOSA (Cuesta 5 créditos)
exports.openMysteryBox = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user.credits < 5) return res.status(400).json({ error: 'Créditos insuficientes (Cuesta 5 SP).' });

        user.credits -= 5;
        user.totalGamesPlayed = (user.totalGamesPlayed || 0) + 1;
        const plays = user.totalGamesPlayed;

        let prize = 0;
        // Lógica Global de Juegos (Hook and Drain)
        if (plays === 1) {
            prize = 50; // El primer gancho
        } else if (user.credits < 10) {
            prize = 50; // Salvavidas
        } else if (user.credits > 80) {
            // Drenaje Agresivo: No queremos que llegue a 100 fácilmente
            const rand = Math.random() * 100;
            if (rand < 90) prize = Math.floor(Math.random() * 2); // 90% gana 0 o 1
            else prize = 2 + Math.floor(Math.random() * 3);      // 10% gana 2-4
        } else {
            // Drenaje Normal
            const rand = Math.random() * 100;
            if (rand < 60) prize = Math.floor(Math.random() * 4); 
            else prize = 4 + Math.floor(Math.random() * 7);      
        }

        user.credits += prize;
        await user.save();
        res.json({ prize, newBalance: user.credits, spent: 5 });
    } catch (error) {
        res.status(500).json({ error: 'Error al abrir la caja.' });
    }
};

// RASPA Y GANA (Cuesta 5 créditos)
exports.scratchCard = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user.credits < 5) return res.status(400).json({ error: 'Créditos insuficientes.' });

        user.credits -= 5;
        user.totalGamesPlayed = (user.totalGamesPlayed || 0) + 1;
        const plays = user.totalGamesPlayed;

        let prize = 0;
        if (plays === 1) {
            prize = 50; 
        } else if (user.credits < 10) {
            prize = 50; 
        } else if (user.credits > 80) {
            const rand = Math.random() * 100;
            if (rand < 90) prize = Math.floor(Math.random() * 2);
            else prize = 2 + Math.floor(Math.random() * 3);
        } else {
            const rand = Math.random() * 100;
            if (rand < 60) prize = Math.floor(Math.random() * 4);
            else prize = 4 + Math.floor(Math.random() * 7);
        }

        user.credits += prize;
        await user.save();
        res.json({ prize, newBalance: user.credits });
    } catch (error) {
        res.status(500).json({ error: 'Error en Raspa y Gana.' });
    }
};

// ELIGE UNA CARTA (Cuesta 5 créditos)
exports.pickCard = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user.credits < 5) return res.status(400).json({ error: 'Créditos insuficientes.' });

        user.credits -= 5;
        user.totalGamesPlayed = (user.totalGamesPlayed || 0) + 1;
        const plays = user.totalGamesPlayed;

        let prize = 0;
        if (plays === 1) {
            prize = 50; 
        } else if (user.credits < 10) {
            prize = 50; 
        } else if (user.credits > 80) {
            const rand = Math.random() * 100;
            if (rand < 90) prize = Math.floor(Math.random() * 2);
            else prize = 2 + Math.floor(Math.random() * 3);
        } else {
            const rand = Math.random() * 100;
            if (rand < 60) prize = Math.floor(Math.random() * 4);
            else prize = 4 + Math.floor(Math.random() * 7);
        }

        user.credits += prize;
        await user.save();
        res.json({ prize, newBalance: user.credits });
    } catch (error) {
        res.status(500).json({ error: 'Error en Elige una Carta.' });
    }
};

exports.exchangeCredits = async (req, res) => {
    try {
        const { raffleId } = req.body;
        const user = await User.findById(req.user._id);

        const COST = 200; // Costo de un ticket

        if (user.credits < COST) {
            return res.status(400).send('No tienes suficientes créditos.');
        }

        const raffle = await Raffle.findById(raffleId);
        if (!raffle || raffle.status !== 'active') {
            return res.status(400).send('Sorteo inválido o inactivo.');
        }

        // Generar Ticket
        let ticketNumber;
        let isUnique = false;
        while (!isUnique) {
            ticketNumber = Math.floor(100000 + Math.random() * 900000).toString();
            const existingTicket = await Ticket.findOne({ ticketNumber });
            if (!existingTicket) isUnique = true;
        }

        const newTicket = new Ticket({
            userId: user._id,
            raffleId: raffle._id,
            ticketNumber,
            status: 'valid',
            source: 'gift' // O podríamos crear 'exchange'
        });

        await newTicket.save();

        // Descontar créditos
        user.credits -= COST;
        await user.save();

        res.redirect('/recompensas?success=ticket');

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al canjear créditos.');
    }
};

exports.playDoubleOrNothing = async (req, res) => {
    try {
        const { bet, choice, isInitial } = req.body;
        const user = await User.findById(req.user._id);

        if (!bet || !choice) return res.status(400).json({ error: 'Faltan datos.' });
        
        // Si es el primer giro de la cadena, cobramos la apuesta inicial
        if (isInitial) {
            if (user.credits < bet) return res.status(400).json({ error: 'Créditos insuficientes.' });
            user.credits -= bet;
            await user.save();
        }

        // Resultado con ventaja de la casa: 60% pierde, 40% gana
        const colors = ['roja', 'negra'];
        const resultColor = Math.random() < 0.4
            ? choice                                          // 40% → acierta
            : colors.find(c => c !== choice);                 // 60% → falla

        const win = choice === resultColor;
        const winnings = win ? bet * 2 : 0;

        // Generar carta visual para el resultado
        const cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const suits = resultColor === 'roja' ? ['♥', '♦'] : ['♠', '♣'];
        const resultCard = cards[Math.floor(Math.random() * cards.length)] + suits[Math.floor(Math.random() * suits.length)];

        res.json({ 
            win, 
            resultColor, 
            resultCard, 
            winnings, 
            newBalance: user.credits 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el juego.' });
    }
};

exports.collectDoubleOrNothing = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido.' });

        const user = await User.findById(req.user._id);
        user.credits += amount;
        await user.save();

        res.json({ success: true, newBalance: user.credits });
    } catch (error) {
        res.status(500).json({ error: 'Error al cobrar.' });
    }
};
