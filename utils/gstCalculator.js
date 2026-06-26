exports.calculateGST = ({ amount = 0, gstRate = 0, isInterState = false }) => {
  const taxableAmount = Number(amount) || 0;
  const rate = Number(gstRate) || 0;

  const gstAmount = (taxableAmount * rate) / 100;

  if (isInterState) {
    return {
      taxableAmount,
      gstRate: rate,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: rate,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: gstAmount,
      gstAmount,
      totalAmount: taxableAmount + gstAmount,
    };
  }

  return {
    taxableAmount,
    gstRate: rate,
    cgstRate: rate / 2,
    sgstRate: rate / 2,
    igstRate: 0,
    cgstAmount: gstAmount / 2,
    sgstAmount: gstAmount / 2,
    igstAmount: 0,
    gstAmount,
    totalAmount: taxableAmount + gstAmount,
  };
};