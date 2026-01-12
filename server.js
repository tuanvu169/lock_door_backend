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
app.post('/register', async (req, res) => {
  try {
    let { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ msg: 'Thiếu username hoặc password' });
    }

    // Buộc role là "USER" nếu không gửi hoặc từ app (ADMIN chỉ tạo qua MongoDB thủ công)
    role = role || 'USER';  // Nếu không gửi role → tự động "USER"
    if (role !== 'USER') {
      return res.status(403).json({ msg: 'Chỉ được tạo tài khoản USER' });
    }

    // Kiểm tra username trùng
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ msg: 'Username đã tồn tại' });
    }

    // Tạo user mới
    const newUser = new User({
      username,
      password,  // plain text → hook sẽ hash
      role       // luôn là "USER"
    });

    await newUser.save();

    res.status(201).json({ msg: 'Tạo tài khoản USER thành công' });
  } catch (err) {
    console.error('Lỗi tạo user:', err);
    res.status(500).json({ msg: 'Lỗi server', error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);

  const HistoryLog = require('./models/DoorHistory');

// Route ghi log mở/đóng cửa từ app
app.post('/log-door', async (req, res) => {
  try {
    const { action, userId, username, status, note } = req.body;

    if (!action || !['mở cửa', 'đóng cửa'].includes(action)) {
      return res.status(400).json({ msg: 'Action không hợp lệ' });
    }

    const log = new HistoryLog({
      action,
      method: 'app',
      userId,
      username: username || 'Unknown',
      status: status || 'thành công',
      note: note || ''
    });

    await log.save();

    res.status(201).json({ msg: 'Đã ghi log mở/đóng cửa' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Lỗi server' });
  }
});
app.get('/history-log', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const logs = await HistoryLog.find()
      .sort({ timestamp: -1 })  // Mới nhất trước
      .limit(parseInt(limit));

    res.json(logs);
  } catch (err) {
    res.status(500).json({ msg: 'Lỗi server' });
  }
});
});