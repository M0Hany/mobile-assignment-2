import express from 'express';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import cors from 'cors';

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());

app.use(express.json());

// Root route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to FCI Student Portal API' });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

app.post('/signup', async (req, res) => {
    console.log(req.body);
    const { name, gender, email, studentId, level, password } = req.body;

    // Validate mandatory fields
    if (!name || !email || !studentId || !password) {
        return res.status(400).send({ message: 'All fields except level and gender are mandatory' });
    }

    // Validate email structure
    const emailRegex = new RegExp(`^${studentId}@stud\\.fci-cu\\.edu\\.eg$`);
    if (!emailRegex.test(email)) {
        return res.status(400).send({ message: 'Email must be in the format studentId@stud.fci-cu.edu.eg and match the studentId' });
    }

    // Validate password
    const passwordRegex = /^(?=.*[0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).send({ message: 'Password must be at least 8 characters long and contain at least 1 number' });
    }

    try {
        const checkExistingStudent = await pool.query(
            'SELECT * FROM students WHERE "studentId" = $1',
            [studentId]
        );

        if (checkExistingStudent.rows.length > 0) {
            return res.status(400).send({ message: 'Student ID already exists' });
        }

        const result = await pool.query(
            'INSERT INTO students (name, gender, email, "studentId", level, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, gender, email, studentId, level, password]
        );
        res.status(201).send({ message: 'User signed up successfully', user: result.rows[0] });
    } catch (error) {
        res.status(500).send({ message: 'Error signing up user', error: error.message });
    }
});

app.post('/login', async (req, res) => {
    const { studentId, password } = req.body;

    // Validate mandatory fields
    if (!studentId || !password) {
        return res.status(400).send({ message: 'Student ID and password are mandatory' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM students WHERE "studentId" = $1 AND password = $2',
            [studentId, password]
        );

        if (result.rows.length > 0) {
            res.status(200).send({ message: 'Login successful', student: result.rows[0] });
        } else {
            res.status(401).send({ message: 'Invalid student ID or password' });
        }
    } catch (error) {
        res.status(500).send({ message: 'Error logging in', error: error.message });
    }
});

app.put('/update-student', upload.single('image'), async (req, res) => {
    const { studentId, name, gender, email, level, password } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate mandatory fields
    if (!studentId) {
        return res.status(400).send({ message: 'Student ID is mandatory' });
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (name) {
        fields.push(`name = $${index++}`);
        values.push(name);
    }
    if (gender) {
        fields.push(`gender = $${index++}`);
        values.push(gender);
    }
    if (email) {
        fields.push(`email = $${index++}`);
        values.push(email);
    }
    if (level) {
        fields.push(`level = $${index++}`);
        values.push(level);
    }
    if (password) {
        fields.push(`password = $${index++}`);
        values.push(password);
    }
    if (imageUrl) {
        fields.push(`image_url = $${index++}`);
        values.push(imageUrl);
    }

    if (fields.length === 0) {
        return res.status(400).send({ message: 'No fields to update' });
    }

    values.push(studentId);

    const query = `UPDATE students SET ${fields.join(', ')} WHERE "studentId" = $${index} RETURNING *`;

    try {
        const result = await pool.query(query, values);
        if (result.rows.length > 0) {
            res.status(200).send({ message: 'Student updated successfully', student: result.rows[0] });
        } else {
            res.status(404).send({ message: 'Student not found' });
        }
    } catch (error) {
        res.status(500).send({ message: 'Error updating student', error: error.message });
    }
});

// Store Management Endpoints
app.get('/api/stores', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM stores');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM stores WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/stores/favorite', async (req, res) => {
    try {
        const { studentId, storeId } = req.body;
        console.log('Debug - studentId:', studentId);
        console.log('Debug - storeId:', storeId);
        
        // First, get the current favorite_stores array
        const currentResult = await pool.query(
            'SELECT favorite_stores FROM students WHERE "studentId" = $1',
            [studentId]
        );
        
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        let favoriteStores = currentResult.rows[0].favorite_stores || [];
        
        // Check if store is already in favorites
        if (favoriteStores.includes(storeId)) {
            return res.status(400).json({ error: 'Store already in favorites' });
        }

        // Add store to favorites
        favoriteStores.push(storeId);
        
        const result = await pool.query(
            'UPDATE students SET favorite_stores = $1 WHERE "studentId" = $2 RETURNING favorite_stores',
            [favoriteStores, studentId]
        );
        
        res.json({ favorite_stores: result.rows[0].favorite_stores });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/stores/favorite', async (req, res) => {
    try {
        const { studentId, storeId } = req.body;
        
        // First, get the current favorite_stores array
        const currentResult = await pool.query(
            'SELECT favorite_stores FROM students WHERE "studentId" = $1',
            [studentId]
        );
        
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        let favoriteStores = currentResult.rows[0].favorite_stores || [];
        
        // Check if store is in favorites
        if (!favoriteStores.includes(storeId)) {
            return res.status(400).json({ error: 'Store not in favorites' });
        }

        // Remove store from favorites
        favoriteStores = favoriteStores.filter(id => id !== storeId);
        
        const result = await pool.query(
            'UPDATE students SET favorite_stores = $1 WHERE "studentId" = $2 RETURNING favorite_stores',
            [favoriteStores, studentId]
        );
        
        res.json({ favorite_stores: result.rows[0].favorite_stores });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/students/:id/favorites', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT s.* FROM stores s JOIN students st ON s.id = ANY(st.favorite_stores) WHERE st."studentId" = $1',
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});