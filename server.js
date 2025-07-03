const express = require("express");
const cors = require("cors");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const mongoUrl =
  "mongodb+srv://mibram61:ikanasin5@webgis-sidokepung.v8qm6lq.mongodb.net/";
const dbName = "webgis-sidokepung";
const collectionName = "rts";
const collectionContoh = "contoh";

// Endpoint untuk mengirim data GeoJSON (Peta)
app.get("/api/peta", async (req, res) => {
  try {
    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const contohCollection = db.collection(collectionContoh); // Ambil koleksi contoh

    const docs = await collection.find({ type: "FeatureCollection" }).toArray();

    // Dapatkan data agregasi untuk jenis kelamin dominan per RT/RW
    const dominantGenderData = await contohCollection
      .aggregate([
        {
          $group: {
            _id: { rt: "$RT", rw: "$RW", jenisKelamin: "$Jenis Kelamin" },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.rt": 1, "_id.rw": 1, count: -1 },
        },
        {
          $group: {
            _id: { rt: "$_id.rt", rw: "$_id.rw" },
            mostDominantGender: { $first: "$_id.jenisKelamin" },
            mostDominantGenderCount: { $first: "$count" },
            totalPopulation: { $sum: "$count" }, // Hitung juga total populasi per RT/RW
          },
        },
        {
          $project: {
            _id: 0,
            rt: "$_id.rt",
            rw: "$_id.rw",
            mostDominantGender: 1,
            mostDominantGenderCount: 1,
            totalPopulation: 1,
          },
        },
      ])
      .toArray();

    const genderMap = new Map();
    dominantGenderData.forEach((item) => {
      genderMap.set(`${item.rt}-${item.rw}`, {
        gender: item.mostDominantGender,
        count: item.mostDominantGenderCount,
        total: item.totalPopulation,
      });
    });

    // server.js (MODIFIKASI PADA BAGIAN app.get("/api/peta"))

    // ... kode sebelumnya ...

    const features = docs.flatMap((doc) => {
      if (!doc.features || !Array.isArray(doc.features)) {
        return [];
      }
      return doc.features.map((feature) => {
        const originalProps = feature.properties;
        const nmsls = originalProps.nmsls || "";
        const rtMatch = nmsls.match(/RT\s(\S+)/);
        const rwMatch = nmsls.match(/RW\s(\S+)/);
        const dusunMatch = nmsls.match(/DUSUN\s(.+)/i);

        // Dapatkan RT/RW dari GeoJSON, lalu konversi ke INTEGER
        const rtGeoJson = rtMatch ? parseInt(rtMatch[1], 10) : null; // Ubah ke integer
        const rwGeoJson = rwMatch ? parseInt(rwMatch[1], 10) : null; // Ubah ke integer

        const dusun = dusunMatch ? dusunMatch[1].trim() : "-";
        const kecamatan = originalProps.nmkec || "-";

        // Kunci map sekarang harus dibuat dari integer
        const dominantInfo =
          rtGeoJson !== null && rwGeoJson !== null
            ? genderMap.get(`${rtGeoJson}-${rwGeoJson}`)
            : null;
        const dominantGender = dominantInfo ? dominantInfo.gender : null;
        const dominantGenderCount = dominantInfo ? dominantInfo.count : 0;
        const totalPopulation = dominantInfo ? dominantInfo.total : 0;

        return {
          ...feature,
          properties: {
            ...originalProps,
            // Simpan RT/RW sebagai string aslinya untuk popup, tapi gunakan integer untuk pencarian map
            RT: rtMatch ? rtMatch[1] : "-",
            RW: rwMatch ? rwMatch[1] : "-",
            dusun: dusun,
            kecamatan: kecamatan,
            nmdesa: originalProps.nmdesa || "Data Tidak Tersedia",
            dominantGender: dominantGender,
            dominantGenderCount: dominantGenderCount,
            totalPopulation: totalPopulation,
          },
        };
      });
    });

    // ... sisa kode server.js ...

    const geojson = {
      type: "FeatureCollection",
      features: features,
    };

    res.json(geojson);
    await client.close();
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    res.status(500).send("Gagal mengambil data GeoJSON dari MongoDB.");
  }
});

// --- HALAMAN STATIS ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// --- API ENDPOINTS ---
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    res.json({ success: true, message: "Login berhasil!" });
  } else {
    res
      .status(401)
      .json({ success: false, message: "Username atau password salah." });
  }
});

// === CRUD API UNTUK COLLECTION  ===

// READ (GET) - Mengambil data, memfilter, dan mentransformasikannya
app.get("/api/contoh", async (req, res) => {
  try {
    const { rt, rw } = req.query;
    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(dbName);
    const collection = db.collection(collectionContoh);

    let query = { "Jenis Kelamin": { $exists: true } };

    if (rt && rw) {
      query.RT = parseInt(rt, 10);
      query.RW = parseInt(rw, 10);
    }

    const dataFromDb = await collection.find(query).toArray();

    const transformedData = dataFromDb.map((item) => {
      return {
        _id: item._id,
        rt: String(item.RT),
        rw: String(item.RW),
        umur: item.Umur,
        jenis_kelamin: item["Jenis Kelamin"],
        status_pekerjaan_utama: item["Status Pekerjaan Utama"],
        nama_anggota: item["Nama Anggota"],
      };
    });

    res.json(transformedData);
    await client.close();
  } catch (error) {
    console.error("Terjadi kesalahan saat mengambil data:", error);
    res.status(500).send("Gagal mengambil data dari MongoDB.");
  }
});

// CREATE (POST) - Menambahkan data baru ke "contoh"
app.post("/api/contoh", async (req, res) => {
  try {
    const {
      rt,
      rw,
      umur,
      jenis_kelamin,
      status_pekerjaan_utama,
      nama_anggota,
    } = req.body;

    if (
      !rt ||
      !rw ||
      !umur ||
      !jenis_kelamin ||
      !status_pekerjaan_utama ||
      !nama_anggota
    ) {
      return res.status(400).json({ message: "Semua field harus diisi." });
    }

    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(dbName);
    const collection = db.collection(collectionContoh);

    const newData = {
      RT: parseInt(rt),
      RW: parseInt(rw),
      Umur: parseInt(umur),
      "Jenis Kelamin": jenis_kelamin,
      "Status Pekerjaan Utama": status_pekerjaan_utama,
      "Nama Anggota": nama_anggota,
      "ID Keluarga": "KEL_BARU", // Anda mungkin ingin membuat ini dinamis nanti
      Timestamp: new Date(),
    };

    const result = await collection.insertOne(newData);
    res.status(201).json({
      message: "Data berhasil ditambahkan",
      insertedId: result.insertedId,
    });
    await client.close();
  } catch (error) {
    console.error("Gagal menambahkan data:", error);
    res.status(500).json({ message: "Gagal menambahkan data ke database." });
  }
});

// UPDATE (PUT) - Memperbarui data di "contoh" berdasarkan ID
app.put("/api/contoh/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      rt,
      rw,
      umur,
      jenis_kelamin,
      status_pekerjaan_utama,
      nama_anggota,
    } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID tidak valid." });
    }

    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(dbName);
    const collection = db.collection(collectionContoh);

    const updatedData = {
      RT: parseInt(rt),
      RW: parseInt(rw),
      Umur: parseInt(umur),
      "Jenis Kelamin": jenis_kelamin,
      "Status Pekerjaan Utama": status_pekerjaan_utama,
      "Nama Anggota": nama_anggota,
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    res.json({ message: "Data berhasil diperbarui." });
    await client.close();
  } catch (error) {
    console.error("Gagal memperbarui data:", error);
    res.status(500).json({ message: "Gagal memperbarui data di database." });
  }
});

// DELETE (DELETE) - Menghapus data dari "contoh" berdasarkan ID
app.delete("/api/contoh/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID tidak valid." });
    }

    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(dbName);
    const collection = db.collection(collectionContoh);

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    res.json({ message: "Data berhasil dihapus." });
    await client.close();
  } catch (error) {
    console.error("Gagal menghapus data:", error);
    res.status(500).json({ message: "Gagal menghapus data dari database." });
  }
});

// Jalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
  console.log(
    `Buka http://localhost:${port}/login.html untuk masuk sebagai admin.`
  );
});
