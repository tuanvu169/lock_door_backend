require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');  // Hoặc Account nếu bạn đã đổi tên model

const app = express();
app.use(express.json());
app.use(cors());

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Route login (giữ nguyên, chỉ thay User nếu cần)
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ msg: 'Thiếu thông tin' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ msg: 'Tài khoản không tồn tại' });
    }

    /*const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ msg: 'Mật khẩu sai' });
    }*/
    if (password !== user.password.toString()) {  // .toString() để xử lý nếu là number
  return res.status(401).json({ msg: 'Mật khẩu sai' });
}

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      msg: 'Đăng nhập thành công',
      role: user.role,
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Lỗi server', error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});