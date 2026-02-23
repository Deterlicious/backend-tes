const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateProdukPajakPayload(data) {
  const errors = [];

  if (!data.produkID || !isValidObjectId(data.produkID)) {
    errors.push("produkID wajib diisi dan valid");
  }

  if (!data.pajakID || !isValidObjectId(data.pajakID)) {
    errors.push("pajakID wajib diisi dan valid");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateProdukPajakPayload };
