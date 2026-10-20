const mongoose = require('mongoose');
require('dotenv').config();
const Payment = require('../src/models/Payment');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const payments = await Payment.find();
    console.log(`Found ${payments.length} total payments.`);
    let fixed = 0;
    for (const p of payments) {
      if (p.receiptImage) {
        const raw = p.receiptImage.replace(/\\/g, '/');
        const filename = raw.split('/').filter(Boolean).pop();
        const normalized = '/uploads/' + filename;
        if (p.receiptImage !== normalized) {
          console.log(`Fixing payment ${p._id}: '${p.receiptImage}' -> '${normalized}'`);
          p.receiptImage = normalized;
          await p.save();
          fixed++;
        }
      }
    }
    console.log(`Migration complete: ${fixed} payment receipt paths normalized.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
