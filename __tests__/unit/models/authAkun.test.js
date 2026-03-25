const authAkun = require("../../../middleware/authAkun");
const jwt = require("jsonwebtoken");

// Skenario A (ketika tidak punya token)
test("harus return 401 jika tidak ada Authorization header", async () => {
  const req = { headers: {} };
  const res = {};
  const next = jest.fn();

  await authAkun(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
});

// Skenario B (ketika token tidak valid)
test("harus return 403 jika token tidak valid", async () => {
  const req = { headers: { authorization: "Bearer token_palsu" } };
  const res = {};
  const next = jest.fn();

  await authAkun(req, res, next);

  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
});
