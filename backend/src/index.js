const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initDB } = require('./db');

const app = express();
app.use(cors({ origin: process.env.APP_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tabs', require('./routes/tabs'));
app.use('/api/sponsors', require('./routes/sponsors'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/deliverables', require('./routes/deliverables'));
app.use('/api/exhibits', require('./routes/exhibits'));

const PORT = process.env.PORT || 4000;
initDB().then(() => app.listen(PORT, () => console.log(`Backend on :${PORT}`))).catch(e => { console.error(e); process.exit(1); });
