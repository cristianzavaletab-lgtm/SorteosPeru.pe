const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  // Gamification Fields
  credits: { type: Number, default: 0 },
  lastLoginDate: { type: Date, default: null },
  streakDays: { type: Number, default: 0 },
  lastFreeSpin: { type: Date, default: null },
  consecutiveExtraSpins: { type: Number, default: 0 },
  lastMysteryChest: { type: Date, default: null },
  mysteryBoxOpens: { type: Number, default: 0 },
  totalGamesPlayed: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
