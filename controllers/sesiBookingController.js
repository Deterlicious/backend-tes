const SesiBooking = require("../models/sesiBookingModel");

exports.createBooking = async (req, res) => {
  try {
    const newBooking = new SesiBooking(req.body);
    const savedBooking = await newBooking.save();

    res.status(201).json(savedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAllBooking = async (req, res) => {
  try {
    const bookings = await SesiBooking.find()
      .populate("asetID")
      .populate("penggunaID")
      .populate("penjualanID");
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await SesiBooking.findById(req.params.id)
      .populate("asetID")
      .populate("penggunaID");
    if (!booking)
      return res.status(404).json({ message: "Booking tidak ditemukan" });
    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const updatedBooking = await SesiBooking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedBooking)
      return res.status(404).json({ message: "Booking tidak ditemukan" });
    res.status(200).json(updatedBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const deletedBooking = await SesiBooking.findByIdAndDelete(req.params.id);
    if (!deletedBooking)
      return res.status(404).json({ message: "Booking tidak ditemukan" });
    res.status(200).json({ message: "Booking berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};