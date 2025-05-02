// handles API requests, MongoDB storage, and file uploads.
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require('multer');
// const fs = require('fs');


const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/theftTracker", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schema and model
const FaultSchema = new mongoose.Schema({
  siteid: String,
  circle: String,
  district: String,
  villageName: String,
  technicianName: String,
  technicianNumber: String,
  incidentOccuranceDate: Date,
  incidentReportingDate: Date,
  apporximateLossAmount: String,
  incidentReportedBy: String,
  insuranceApplicable: String,
  mobileNumberOfIncidentReportedBy:String,
  lostItems:String,
  lossDescription: String,
  responsibility: String,
  targetDate: Date,
  closureDate: Date,
  actionTaken: String,
  reasonForLoss: String,
  closureStatus: String,
  referenceId: String,
  incidentPhoto:String,
  incidentPhoto1:String
});



const Theft = mongoose.model("Theft", FaultSchema);

// Counter collection to generate reference IDs
//generate auto-incremented referenceId.
const CounterSchema = new mongoose.Schema({
  name: String,
  count: Number,
});


//4) Multer File Upload Configuration
//Stores uploaded files in /uploads
const TheftCounter = mongoose.model("TheftCounter", CounterSchema);
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Folder where files will be uploaded
  },
  filename: (req, file, cb) => {
    // Generate a unique filename with a timestamp and random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `${uniqueSuffix}.png`; // Force the extension to be .png
    cb(null, fileName); // Set the filename with .png extension
  }
});
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Configure multer with storage options and file filter to allow only image files
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Only accept .jpg, .jpeg, .png extensions
    if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
      return cb(new Error('Only image files (jpg, jpeg, png) are allowed!'), false);
    }
    cb(null, true); // Accept the file
  }
});
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3)Generate Reference ID
app.get("/api/generate-id", async (req, res) => {
    try {
      let counter1= await TheftCounter.findOne({ name: "refCounter" });  // Fetches the refCounter document.
      console.log(counter1);
      if (!counter1) {
        counter1 = new TheftCounter({ name: "refCounter", count: 1 }); // ✅ No let here
      } else {
        counter1.count++;
      }
  
      await counter1.save();
  
    //   const refId = FT-${counter1.count}; // ✅ Use backticks
    //   res.json({ referenceId: refId });
    let counter2=counter1;

    const refId =`IT-${counter2.count}`; // ✅ Correct way to interpolate
    res.json({ referenceId: refId });

    } catch (err) {
      console.log("Error generating ID:", err);
      res.status(500).json({ error: "Failed to generate reference ID" });
    }
  });

//5) Submit Fault Form
app.post("/api/faults", upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'image1', maxCount: 1 }
]), async (req, res) => {
  const { json_data } = req.body;
  const data = JSON.parse(json_data);

  console.log(data);  // Parsed JSON data sent by client side

  if (!data.referenceId) {
    return res.status(400).json({ error: "Reference ID is required." });
  }

  // Attach uploaded filenames to the data object
  if (req.files['image']) {
    data.incidentPhoto = req.files['image'][0].filename;
  }
  if (req.files['image1']) {
    data.incidentPhoto1 = req.files['image1'][0].filename;
  }
//  ----------------------------------------------new-----------------------------
// if (req.file) {
//   data.incidentPhoto1 = req.file.filename;  // Store the filename of the uploaded photo
// }
  // Create a new document in MongoDB with the form data
  const theft = new Theft(data);

  try {
    // Save the document to MongoDB
    await theft.save();
    res.json({ message: "Data submitted successfully!" });
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({ error: "Failed to save the data." });
  }
});

//6) Search by Reference ID
// Retrieves a single ticket by referenceId or siteid
app.get("/api/faults/:id", async (req, res) => {
  // const theft = await Theft.findOne({ referenceId : req.params.id });
  const theft = await Theft.findOne({
    $or: [
      { referenceId: req.params.id},
      { siteid: req.params.id}
    ]
  });

  if (!theft) {
    return res.status(404).json({ error: "No record found." });
  }

  res.json(theft);
});

//7)Retrieves all theft/damage records
app.get("/api/faults", async (req, res) => {
  try {
    const theft = await Theft.find(); // 👈 fetches all documents
    res.json(theft);
  } catch (err) {
    console.error("Error fetching faults:", err);
    res.status(500).json({ error: "Failed to fetch theft records" });
  }
});

//8)Deletes a record by its referenceId
app.delete("/api/faults/:referenceId", async (req, res) => {
  const { referenceId } = req.params;
  try {
    const deletedFault = await Theft.findOneAndDelete({ referenceId });

    if (!deletedFault) {
      return res.status(404).json({ error: "Fault not found" });
    }

    res.json({ message: "theft deleted successfully", data: deletedFault });
  } catch (err) {
    console.error("Error deleting theft by referenceId:", err);
    res.status(500).json({ error: "Failed to delete theft record" });
  }
});

//9) Update Fault by Reference ID
app.put("/api/faults/:referenceId", async (req, res) => {
  const { referenceId } = req.params;
console.log(req.body);
  try {
    const updatedFault = await Theft.findOneAndUpdate(
      { referenceId },
      req.body,
      { new: true } // return the updated doc
    );

    if (!updatedFault) {
      return res.status(404).json({ error: "Theft not found" });
    }

    res.json({ message: "theft updated successfully", data: updatedFault });
  } catch (err) {
    console.error("Error updating theft:", err);
    res.status(500).json({ error: "Failed to update theft record" });
  }
});


const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


