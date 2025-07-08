const express = require("express");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads")); // static folder for media

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send OTP
app.post("/auth/send-otp", (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const url = process.env.MONGODB_URL;
  const con = new MongoClient(url);
  const db = con.db("project_showcase");
  const coll = db.collection("otp");

  // Delete old OTPs and insert new one
  coll.deleteMany({ email })
    .then(() => coll.insertOne({ email, otp, createdAt: new Date() }))
    .then(() =>
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP is ${otp}`,
      })
    )
    .then(() => res.send({ message: "OTP sent to email" }))
    .catch((err) => {
      console.error("Error sending OTP:", err);
      res.status(500).send({ error: err.message });
    });
});

// Verify OTP
app.post("/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const url = process.env.MONGODB_URL;
  const con = new MongoClient(url);
  const db = con.db("project_showcase");
  const coll = db.collection("otp");

  coll.findOne({ email, otp })
    .then((doc) => {
      if (!doc) return res.status(400).send({ error: "Invalid OTP" });
      return coll.deleteMany({ email }).then(() =>
        res.send({ userId: email + "-user" })
      );
    })
    .catch((err) => {
      console.error("Error verifying OTP:", err);
      res.status(500).send({ error: err.message });
    });
});

// Add Project
app.post("/projects", upload.single("image"), (req, res) => {
  const { title, description, techStack, live, userId, email } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!title || !description || !techStack || !userId || !email) {
    return res.status(400).send({ error: "Missing required fields" });
  }

  const url = process.env.MONGODB_URL;
  const con = new MongoClient(url);
  const db = con.db("project_showcase");
  const coll = db.collection("projects");

  const doc = {
    title,
    description,
    techStack: techStack.split(",").map((t) => t.trim()),
    live,
    image,
    userId,
    createdAt: new Date(),
  };

  coll.insertOne(doc)
    .then(() =>
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Project Submitted",
        text: `Your project "${title}" was submitted successfully.`,
      })
    )
    .then(() => res.send({ message: "Project added" }))
    .catch((err) => {
      console.error("Error adding project:", err);
      res.status(500).send({ error: err.message });
    });
});

// Get All Projects
app.get("/projects", (req, res) => {
  const url = process.env.MONGODB_URL;
  const con = new MongoClient(url);
  const db = con.db("project_showcase");
  const coll = db.collection("projects");

  coll.find().toArray()
    .then((docs) => res.send(docs))
    .catch((err) => {
      console.error("Error getting projects:", err);
      res.status(500).send({ error: err.message });
    });
});

// Update Project
app.put("/projects/updates/:id", upload.single("image"), (req, res) => {
  const id = req.params.id;
  const { description, techStack, live, userId, email } = req.body;
  const media = req.file ? req.file.filename : null;

  if (!description || !techStack) {
    return res.status(400).send({ error: "Missing required fields" });
  }

  const url = process.env.MONGODB_URL;
  const con = new MongoClient(url);
  const db = con.db("project_showcase");
  const coll = db.collection("projects");

  const updateDoc = {
    description,
    techStack: techStack.split(",").map((t) => t.trim()),
    live,
    userId,
    email,
  };

  if (media) updateDoc.image = media;

  coll.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc })
    .then((result) => {
      if (result.matchedCount === 0) {
        return res.status(404).send({ error: "Project not found" });
      }
      res.send({ message: "Project updated successfully" });
    })
    .catch((error) => {
      console.error("Error updating project:", error);
      res.status(500).send({ error: error.message });
    });
});

// Delete Project
app.delete("/projects/:id", (req, res) => {
  const id = req.params.id;
  const url = process.env.MONGODB_URL;
  const con = new MongoClient(url);
  const db = con.db("project_showcase");
  const coll = db.collection("projects");

  coll.deleteOne({ _id: new ObjectId(id) })
    .then(() => res.send({ message: "Project deleted successfully" }))
    .catch((err) => {
      console.error("Error deleting project:", err);
      res.status(500).send({ error: err.message });
    });
});

// Start Server
app.listen(9000, () => {
  console.log("✅ Server is running on http://localhost:9000");
});
