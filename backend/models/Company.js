const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [150, 'Company name cannot exceed 150 characters'],
    },
    contactEmail: {
      type: String,
      required: [true, 'Company email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    logo: { type: String, default: '' },
    phone: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    preferredLanguage: { type: String, default: 'English' },
    timezone: { type: String, default: 'Africa/Mogadishu' },
    status: {
      type: String,
      enum: ['active', 'suspended', 'disabled'],
      default: 'active',
      index: true,
    },
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

companySchema.index({ name: 1 });
companySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Company', companySchema);
