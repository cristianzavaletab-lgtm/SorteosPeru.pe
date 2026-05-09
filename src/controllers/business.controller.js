const Business = require('../models/Business');
const BusinessCampaign = require('../models/BusinessCampaign');
const BusinessCode = require('../models/BusinessCode');
const Ticket = require('../models/Ticket');
const Raffle = require('../models/Raffle');

// Generador de código alfanumérico aleatorio
const generateRandomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

// Generar Ticket Number
const generateTicketNumber = async () => {
    let ticketNumber;
    let isUnique = false;
    while (!isUnique) {
        ticketNumber = Math.floor(100000 + Math.random() * 900000).toString();
        const existingTicket = await Ticket.findOne({ ticketNumber });
        if (!existingTicket) isUnique = true;
    }
    return ticketNumber;
};

// ========================
// ADMIN CONTROLLERS
// ========================

exports.getAdminBusinesses = async (req, res) => {
    try {
        const businesses = await Business.find().sort('-createdAt');
        const campaigns = await BusinessCampaign.find().populate('businessId raffleId');
        
        // Agregar stats a cada negocio
        const businessesWithStats = businesses.map(b => {
            const bizCampaigns = campaigns.filter(c => c.businessId._id.toString() === b._id.toString());
            let purchased = 0, extra = 0, total = 0, used = 0, available = 0;
            bizCampaigns.forEach(c => {
                purchased += c.purchasedTickets;
                extra += c.bonusTickets;
                total += c.totalCodes;
                used += c.usedCodes;
                available += c.availableCodes;
            });
            return {
                ...b.toObject(),
                stats: { purchased, extra, total, used, available }
            };
        });

        res.render('admin/businesses', { 
            title: 'Negocios Aliados', 
            businesses: businessesWithStats,
            activePath: '/admin/businesses'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading businesses');
    }
};

exports.createBusiness = async (req, res) => {
    try {
        const { name, contactName, phone, promoDescription } = req.body;
        await Business.create({ name, contactName, phone, promoDescription });
        res.redirect('/admin/businesses');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating business');
    }
};

exports.getBusinessDetail = async (req, res) => {
    try {
        const business = await Business.findById(req.params.id);
        if (!business) return res.status(404).send('Business not found');

        const campaigns = await BusinessCampaign.find({ businessId: business._id }).populate('raffleId');
        const codes = await BusinessCode.find({ businessId: business._id })
            .populate('usedBy', 'name email phone')
            .populate('campaignId')
            .populate('raffleId', 'title')
            .sort('-createdAt');

        const raffles = await Raffle.find({ status: 'active' });

        res.render('admin/business-detail', {
            title: `Negocio: ${business.name}`,
            business,
            campaigns,
            codes,
            raffles,
            activePath: '/admin/businesses'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading business details');
    }
};

exports.createCampaign = async (req, res) => {
    try {
        const { businessId } = req.params;
        const { raffleId, purchasedTickets, bonusTickets } = req.body;
        
        const total = parseInt(purchasedTickets) + parseInt(bonusTickets);

        await BusinessCampaign.create({
            businessId,
            raffleId,
            purchasedTickets: parseInt(purchasedTickets),
            bonusTickets: parseInt(bonusTickets),
            totalCodes: total,
            availableCodes: total,
            usedCodes: 0
        });

        res.redirect(`/admin/businesses/${businessId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating campaign');
    }
};

exports.generateCodes = async (req, res) => {
    try {
        const { businessId, campaignId } = req.params;
        const campaign = await BusinessCampaign.findById(campaignId).populate('businessId');
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        // Verificar cuántos códigos ya se han generado para esta campaña
        const existingCodesCount = await BusinessCode.countDocuments({ campaignId });
        const remainingToGenerate = campaign.totalCodes - existingCodesCount;

        if (remainingToGenerate <= 0) {
            return res.status(400).json({ error: 'All codes for this campaign are already generated.' });
        }

        const prefix = campaign.businessId.name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '') + '-';
        
        const codesToInsert = [];
        for (let i = 0; i < remainingToGenerate; i++) {
            codesToInsert.push({
                code: prefix + generateRandomString(6),
                businessId: campaign.businessId._id,
                campaignId: campaign._id,
                raffleId: campaign.raffleId
            });
        }

        await BusinessCode.insertMany(codesToInsert);
        res.redirect(`/admin/businesses/${businessId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating codes');
    }
};

// ========================
// PUBLIC/USER CONTROLLERS
// ========================

exports.getPublicBusinesses = async (req, res) => {
    try {
        const businesses = await Business.find({ status: 'active' });
        res.render('public-businesses', {
            title: 'Negocios Aliados',
            businesses
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar negocios');
    }
};

exports.getRedeemPage = (req, res) => {
    res.render('redeem', {
        title: 'Canjear Código',
        error: null,
        success: null
    });
};

exports.redeemCode = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user._id; // Usar req.user._id del protect middleware

        const businessCode = await BusinessCode.findOne({ code: code.trim().toUpperCase() }).populate('businessId').populate('raffleId');
        
        if (!businessCode) {
            return res.render('redeem', { title: 'Canjear Código', error: 'Código inválido. Verifica que esté escrito correctamente.', success: null });
        }

        if (businessCode.status === 'used') {
            return res.render('redeem', { title: 'Canjear Código', error: 'Este código ya fue utilizado.', success: null });
        }

        if (businessCode.status === 'expired') {
            return res.render('redeem', { title: 'Canjear Código', error: 'Este código ya venció.', success: null });
        }

        // Validar si el sorteo sigue activo
        if (businessCode.raffleId.status !== 'active') {
             return res.render('redeem', { title: 'Canjear Código', error: 'El sorteo asociado a este código ya no está activo.', success: null });
        }

        // REGLA: 1 usuario solo puede canjear 1 código del mismo negocio para el mismo sorteo.
        const existingTicket = await Ticket.findOne({
            userId: userId,
            raffleId: businessCode.raffleId._id,
            source: 'business_code',
            businessId: businessCode.businessId._id
        });

        if (existingTicket) {
            return res.render('redeem', { title: 'Canjear Código', error: `Ya has canjeado un código de ${businessCode.businessId.name} para este sorteo. Límite de 1 código promocional por negocio por sorteo.`, success: null });
        }

        // Todo correcto, crear ticket
        const ticketNumber = await generateTicketNumber();
        const newTicket = new Ticket({
            userId,
            raffleId: businessCode.raffleId._id,
            ticketNumber,
            status: 'valid',
            source: 'business_code',
            businessId: businessCode.businessId._id,
            businessCodeId: businessCode._id
        });

        await newTicket.save();

        // Actualizar código
        businessCode.status = 'used';
        businessCode.usedBy = userId;
        businessCode.usedAt = new Date();
        await businessCode.save();

        // Actualizar campaña stats
        await BusinessCampaign.findByIdAndUpdate(businessCode.campaignId, {
            $inc: { usedCodes: 1, availableCodes: -1 }
        });

        res.render('redeem', { title: 'Canjear Código', error: null, success: '🎉 Código canjeado correctamente. Tu ticket fue agregado al sorteo.' });

    } catch (error) {
        console.error(error);
        res.render('redeem', { title: 'Canjear Código', error: 'Ocurrió un error al canjear el código.', success: null });
    }
};
