const money = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
const STATE_NAMES = { '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory' };

const validateHsn = value => {
  const code = String(value || '').trim();
  if (code && !/^(?:\d{4}|\d{6}|\d{8})$/.test(code)) throw new Error('HSN code must contain 4, 6, or 8 digits');
  return code || null;
};

const validateRate = value => {
  const rate = Number(value);
  if (!Number.isFinite(rate) || !GST_RATES.includes(rate)) throw new Error('Select a valid GST rate');
  return rate;
};

const stateCodeFromGstin = gstin => {
  const text = String(gstin || '').trim().toUpperCase();
  return /^\d{2}[A-Z0-9]{13}$/.test(text) ? text.slice(0, 2) : null;
};

const splitTax = (taxAmount, supplyType = 'INTRA') => {
  const total = money(taxAmount);
  if (supplyType === 'INTER') return { cgst_amount: 0, sgst_amount: 0, igst_amount: total };
  const cgst = money(total / 2);
  return { cgst_amount: cgst, sgst_amount: money(total - cgst), igst_amount: 0 };
};

module.exports = { GST_RATES, STATE_NAMES, validateHsn, validateRate, stateCodeFromGstin, splitTax, money };
