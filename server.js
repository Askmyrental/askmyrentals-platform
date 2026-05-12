const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, "cleaner-app-data.json");

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      properties: [],
      cleanings: [],
      records: [],
      messages: [],
      cleaners: [],
    };
  }

  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get("/api/app-data", (req, res) => {
  res.json(readData());
});

app.post("/api/app-data", (req, res) => {
  writeData(req.body);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Cleaner App backend running at http://localhost:${PORT}`);
});