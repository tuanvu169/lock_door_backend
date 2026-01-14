require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');          // Model User (plain text password)
const HistoryLog = require('./models/DoorHistory'); // Model lịch sử mở cửa
const DoorHistory = require('./models/DoorHistory');
const House = require('./models/House');
const app = express();
app.use(express.json());
app.use(cors());

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Route Đăng nhập (chỉ kiểm tra email + password plain text)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: 'Thiếu email hoặc password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ msg: 'Tài khoản không tồn tại' });
    }

    // So sánh plain text
    if (password !== user.passwordHash) {
      return res.status(401).json({ msg: 'Mật khẩu sai' });
    }

    // Tạo token (không cần role)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      msg: 'Đăng nhập thành công',
      token,
      name: user.name  // Trả tên để app hiển thị
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Lỗi server', error: err.message });
  }
});

// Route Đăng ký (role mặc định "USER", password plain text)
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: 'Thiếu thông tin (name, email, password)' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'Email đã tồn tại' });
    }

    const newUser = new User({
      name,
      email,
      passwordHash: password  // Lưu plain text
    });

    await newUser.save();

    res.status(201).json({ msg: 'Đăng ký thành công' });
  } catch (err) {
    console.error('Lỗi đăng ký:', err);
    res.status(500).json({ msg: 'Lỗi server', error: err.message });
  }
});

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
    console.error('Lỗi ghi log:', err);
    res.status(500).json({ msg: 'Lỗi server' });
  }
});

// Route đọc lịch sử mở cửa
app.get('/history-log', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const logs = await DoorHistory.find()
      .sort({ timestamp: -1 })  // Mới nhất trước
      .limit(parseInt(limit));

    res.json(logs);
  } catch (err) {
    console.error('Lỗi đọc lịch sử:', err);
    res.status(500).json({ msg: 'Lỗi server' });
  }
});


// Route thêm nhà mới (POST /houses)
app.post('/houses', async (req, res) => {
  try {
    const { name, address } = req.body;

    if (!name) {
      return res.status(400).json({ msg: 'Thiếu tên nhà' });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ msg: 'Không có token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const ownerId = decoded.userId;

    const newHouse = new House({
      ownerId,
      name,
      address: address || ''
    });

    await newHouse.save();

    res.status(201).json({ msg: 'Thêm nhà thành công', house: newHouse });
  } catch (err) {
    console.error('Lỗi thêm nhà:', err);
    res.status(500).json({ msg: 'Lỗi server' });
  }
});

// Route lấy danh sách nhà của user (GET /houses)
app.get('/houses', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ msg: 'Không có token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const ownerId = decoded.userId;

    const houses = await House.find({ ownerId }).sort({ createdAt: -1 });

    res.json(houses);
  } catch (err) {
    res.status(500).json({ msg: 'Lỗi server' });
  }
});
// Route lấy chi tiết 1 nhà (GET /houses/:id)
app.get('/houses/:id', authMiddleware, async (req, res) => {
  try {
    const houseId = req.params.id;
    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ msg: 'Nhà không tồn tại' });
    }

    if (house.ownerId.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Bạn không có quyền xem nhà này' });
    }

    res.json(house);
  } catch (err) {
    console.error('Lỗi lấy chi tiết nhà:', err);
    res.status(500).json({ msg: 'Lỗi server' });
  }
});
// Route thêm khóa cửa vào nhà (PUT /houses/:id/doors)
app.put('/houses/:id/doors', async (req, res) => {
  try {
    const houseId = req.params.id;
    const { name, location } = req.body;

    if (!name) {
      return res.status(400).json({ msg: 'Thiếu tên khóa cửa' });
    }

    // Kiểm tra token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ msg: 'Không có token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const ownerId = decoded.userId;

    // Tìm nhà và kiểm tra quyền sở hữu
    const house = await House.findById(houseId);
    if (!house) {
      return res.status(404).json({ msg: 'Nhà không tồn tại' });
    }

    if (house.ownerId.toString() !== ownerId) {
      return res.status(403).json({ msg: 'Bạn không có quyền thêm khóa cho nhà này' });
    }

    // Thêm khóa mới vào mảng doors
    house.doors.push({
      name,
      location: location || '',
      status: 'LOCKED'
    });

    await house.save();

    res.json({ msg: 'Đã thêm khóa cửa thành công', house });
  } catch (err) {
    console.error('Lỗi thêm khóa:', err);
    res.status(500).json({ msg: 'Lỗi server' });
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});