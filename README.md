```markdown
# EduLink Ghana Backend Development Process

## Step 1: Set Up the Project

### Initialize the Project
```bash
mkdir edulink-ghana-backend
cd edulink-ghana-backend
npm init -y
```

### Install Dependencies
```bash
npm install express mongoose dotenv bcryptjs jsonwebtoken multer nodemailer crypto
npm install --save-dev nodemon
```

### Set Up Project Structure
```bash
mkdir src
mkdir src/controllers src/models src/routes src/middleware src/config
touch src/app.js src/server.js src/config/db.js
```

## Step 2: Configure Environment Variables

### Create a `.env` File
```plaintext
PORT=5000
MONGO_URI=your_mongo_db_connection_string
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
BASE_URL=http://localhost:5000
```

## Step 3: Set Up Database Connection

### Configure Mongoose
```javascript
// src/config/db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;
```

## Step 4: Set Up the Express Server

### Configure Express
```javascript
// src/app.js
import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';

dotenv.config();
connectDB();

const app = express();

app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/teachers', teacherRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

export default app;
```

### Start the Server
```javascript
// src/server.js
import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Add Nodemon Script
```json
// package.json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js"
}
```

## Step 5: Create Models

### User Model
```javascript
// src/models/userModel.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['learner', 'parent'] },
  isConfirmed: { type: Boolean, default: false },
  confirmationToken: { type: String },
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.createConfirmationToken = function () {
  const token = crypto.randomBytes(20).toString('hex');
  this.confirmationToken = crypto.createHash('sha256').update(token).digest('hex');
  return token;
};

const User = mongoose.model('User', userSchema);

export default User;
```

### Teacher Model
```javascript
// src/models/teacherModel.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const teacherSchema = mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: String, required: true },
  password: { type: String, required: true },
  subjects: { type: [String] },
  area: { type: String },
  availability: { type: [String] },
  costPerHour: { type: Number },
  qualifications: { type: [String] },
  reviews: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: { type: Number, required: true },
      comment: { type: String, required: true },
    },
  ],
});

teacherSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

teacherSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const Teacher = mongoose.model('Teacher', teacherSchema);

export default Teacher;
```

## Step 6: Create Routes and Controllers

### User Routes and Controllers
```javascript
// src/routes/userRoutes.js
import express from 'express';
import { registerUser, authUser, getUserProfile, confirmUser } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', authUser);
router.post('/register', registerUser);
router.get('/confirm/:token', confirmUser);
router.route('/profile').get(protect, getUserProfile);

export default router;
```

```javascript
// src/controllers/userController.js
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';
import sendConfirmationEmail from '../config/nodemailer.js';
import crypto from 'crypto';

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, mobileNumber, password, role } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    fullName,
    email,
    mobileNumber,
    password,
    role,
  });

  if (user) {
    const confirmationToken = user.createConfirmationToken();
    await user.save({ validateBeforeSave: false });
    sendConfirmationEmail(user.fullName, user.email, confirmationToken);

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      message: 'Confirmation email sent. Please confirm your account.',
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

const confirmUser = asyncHandler(async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    confirmationToken: hashedToken,
    isConfirmed: false,
  });

  if (!user) {
    res.status(400);
    throw new Error('Token is invalid or has expired');
  }

  user.isConfirmed = true;
  user.confirmationToken = undefined;
  await user.save();

  res.status(200).json({
    message: 'Account confirmed successfully',
  });
});

const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    if (!user.isConfirmed) {
      res.status(401);
      throw new Error('Account not confirmed');
    }

    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

export { registerUser, authUser, getUserProfile, confirmUser };
```

### Teacher Routes and Controllers
```javascript
// src/routes/teacherRoutes.js
import express from 'express';
import {
  registerTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
} from '../controllers/teacherController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(getAllTeachers).post(registerTeacher);
router
  .route('/:id')
  .get(getTeacherById)
  .put(protect, updateTeacher);

export default router;
```

```javascript
// src/controllers/teacherController.js
import asyncHandler from 'express-async-handler';
import Teacher from '../models/teacherModel.js';
import generateToken from '../utils

/generateToken.js';

const registerTeacher = asyncHandler(async (req, res) => {
  const { fullName, email, mobileNumber, password } = req.body;

  const teacherExists = await Teacher.findOne({ email });

  if (teacherExists) {
    res.status(400);
    throw new Error('Teacher already exists');
  }

  const teacher = await Teacher.create({
    fullName,
    email,
    mobileNumber,
    password,
  });

  if (teacher) {
    res.status(201).json({
      _id: teacher._id,
      fullName: teacher.fullName,
      email: teacher.email,
      mobileNumber: teacher.mobileNumber,
      token: generateToken(teacher._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid teacher data');
  }
});

const getAllTeachers = asyncHandler(async (req, res) => {
  const teachers = await Teacher.find({});
  res.json(teachers);
});

const getTeacherById = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id);

  if (teacher) {
    res.json(teacher);
  } else {
    res.status(404);
    throw new Error('Teacher not found');
  }
});

const updateTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id);

  if (teacher) {
    teacher.fullName = req.body.fullName || teacher.fullName;
    teacher.email = req.body.email || teacher.email;
    teacher.mobileNumber = req.body.mobileNumber || teacher.mobileNumber;
    teacher.subjects = req.body.subjects || teacher.subjects;
    teacher.area = req.body.area || teacher.area;
    teacher.availability = req.body.availability || teacher.availability;
    teacher.costPerHour = req.body.costPerHour || teacher.costPerHour;
    teacher.qualifications = req.body.qualifications || teacher.qualifications;

    const updatedTeacher = await teacher.save();

    res.json({
      _id: updatedTeacher._id,
      fullName: updatedTeacher.fullName,
      email: updatedTeacher.email,
      mobileNumber: updatedTeacher.mobileNumber,
      subjects: updatedTeacher.subjects,
      area: updatedTeacher.area,
      availability: updatedTeacher.availability,
      costPerHour: updatedTeacher.costPerHour,
      qualifications: updatedTeacher.qualifications,
    });
  } else {
    res.status(404);
    throw new Error('Teacher not found');
  }
});

export { registerTeacher, getAllTeachers, getTeacherById, updateTeacher };
```

## Step 7: Middleware for Authentication

### Create Authentication Middleware
```javascript
// src/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

export { protect };
```

## Step 8: Utility Functions

### Generate Token
```javascript
// src/utils/generateToken.js
import jwt from 'jsonwebtoken';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

export default generateToken;
```

### Nodemailer Configuration
```javascript
// src/config/nodemailer.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendConfirmationEmail = (name, email, confirmationToken) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Account Confirmation',
    html: `<h1>Welcome to EduLink Ghana, ${name}!</h1>
           <p>Please confirm your account by clicking the following link:</p>
           <a href="${process.env.BASE_URL}/api/users/confirm/${confirmationToken}">Confirm your account</a>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};

export default sendConfirmationEmail;
```

## Step 9: Run the Server
```bash
npm run dev
```

With these steps, you have the backend of EduLink Ghana set up, including user and teacher registration, authentication, and email confirmation.
```
