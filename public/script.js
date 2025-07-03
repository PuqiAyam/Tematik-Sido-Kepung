// script.js

const map = L.map("map").setView([-7.379, 112.73], 13);

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  }
).addTo(map);

// Palet warna modern untuk chart (digunakan untuk data selain jenis kelamin)
const chartColors = [
  "#0052D4",
  "#4361ee",
  "#7400b8",
  "#65C7F7",
  "#560bad",
  "#4895ef",
  "#f72585",
  "#b5179e",
];

// Warna merah gelap untuk highlight
const darkRedColor = "#8B0000";

// Warna gradasi biru gelap untuk peta
// Contoh gradasi biru dari terang ke gelap
const blueGradient = [
  "#add8e6", // Light Blue (default)
  "#87ceeb", // Sky Blue
  "#6495ed", // Cornflower Blue
  "#4682b4", // Steel Blue
  "#1e90ff", // Dodger Blue
  "#0000cd", // Medium Blue
  "#00008b", // Dark Blue
  "#00005a", // Very Dark Blue - added one more for stronger dark
];

let processedChartData = {};
let currentChart;
let currentDataKey = "jenisKelamin";
let currentChartType = "bar";
let allRawData = [];
let selectedLayer = null;
let geoLayerGlobal; // Simpan referensi ke layer GeoJSON global

async function fetchDataAndUpdateViews(rt = null, rw = null) {
  let apiUrl = "/api/contoh";
  if (rt && rw) {
    apiUrl += `?rt=${rt}&rw=${rw}`;
  }

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    allRawData = data;
    console.log("Fetched raw data for charts:", allRawData); // Log data mentah
    processedChartData = processDataForCharts(allRawData);
    renderChart(currentDataKey, currentChartType);
    updateTableView();
  } catch (err) {
    console.error("Gagal mengambil atau memproses data:", err);
  }
}

fetch("/api/peta")
  .then((res) => {
    console.log("GeoJSON fetch response status:", res.status); // Log status respon
    return res.json();
  })
  .then((data) => {
    console.log("Fetched GeoJSON data:", data); // Log data GeoJSON yang diterima
    geoLayerGlobal = L.geoJSON(data, {
      // Simpan ke variabel global
      style: (feature) => {
        // Panggil fungsi untuk menentukan warna berdasarkan dominasi
        return getMapStyle(feature.properties);
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const dominantText = props.dominantGender
          ? `Jenis Kelamin Dominan: <b>${props.dominantGender}</b> (${(
              (props.dominantGenderCount / props.totalPopulation) *
              100
            ).toFixed(1)}%)<br>`
          : "";

        const popupContent = `
           <b>${props.nmdesa || "-"}</b><br>
           RT: ${props.RT || "-"}<br>
           RW: ${props.RW || "-"}<br>
           Dusun: ${props.dusun || "-"}<br>
           Kecamatan: ${props.kecamatan || "-"}<br>
           ${dominantText}
       `;
        layer.bindPopup(popupContent);

        layer.on({
          click: (e) => {
            if (selectedLayer) {
              // Reset style layer yang sebelumnya dipilih ke warna dominasi default
              geoLayerGlobal.resetStyle(selectedLayer); // Gunakan geoLayerGlobal untuk reset
            }
            const clickedLayer = e.target;
            clickedLayer.setStyle({ fillColor: "#00008B", fillOpacity: 0.9 }); // Warna highlight saat diklik
            clickedLayer.bringToFront();
            selectedLayer = clickedLayer;
            const { RT, RW } = clickedLayer.feature.properties;
            console.log("Clicked on RT:", RT, "RW:", RW); // Log RT/RW yang diklik
            fetchDataAndUpdateViews(RT, RW);
            document.getElementById(
              "selected-area-title"
            ).textContent = `Data untuk RT ${RT} / RW ${RW}`;
          },
        });
      },
    }).addTo(map);

    if (geoLayerGlobal.getBounds().isValid()) {
      map.fitBounds(geoLayerGlobal.getBounds());
    } else {
      console.warn("GeoJSON bounds are not valid, map cannot fit bounds.");
    }
  })
  .catch((err) => console.error("Gagal mengambil data GeoJSON:", err));

// Fungsi untuk menentukan warna peta berdasarkan jenis kelamin dominan
function getMapStyle(props) {
  console.log("Processing map style for properties:", props); // Log properti setiap fitur
  const dominantGender = (props.dominantGender || "").toLowerCase().trim();
  const totalPopulation = props.totalPopulation || 0;
  const dominantGenderCount = props.dominantGenderCount || 0;

  let fillColor = "#ADD8E6"; // Warna default jika tidak ada data atau tidak relevan
  let opacity = 0.7;

  if (totalPopulation > 0 && dominantGender) {
    const percentage = dominantGenderCount / totalPopulation;
    console.log(
      `RT ${props.RT} RW ${
        props.RW
      }: Dominant Gender: ${dominantGender}, Count: ${dominantGenderCount}, Total: ${totalPopulation}, Percentage: ${percentage.toFixed(
        2
      )}`
    ); // Detail dominasi

    let colorIndex;
    // Menggunakan 6 rentang untuk 7 warna di blueGradient (0-6)
    if (percentage === 0) {
      colorIndex = 0; // Default jika persentase 0 (meskipun sudah dicek di if atas)
    } else if (percentage <= 0.15) {
      // 0-15%
      colorIndex = 1;
    } else if (percentage <= 0.3) {
      // 15-30%
      colorIndex = 2;
    } else if (percentage <= 0.45) {
      // 30-45%
      colorIndex = 3;
    } else if (percentage <= 0.6) {
      // 45-60%
      colorIndex = 4;
    } else if (percentage <= 0.75) {
      // 60-75%
      colorIndex = 5;
    } else {
      // > 75%
      colorIndex = 6;
    }

    fillColor = blueGradient[colorIndex];
    opacity = 0.9; // Tingkatkan opacity untuk area yang memiliki data dominan
    console.log(`RT ${props.RT} RW ${props.RW} will be colored: ${fillColor}`); // Log warna yang dipilih
  } else {
    console.log(
      `No dominant gender data or total population for RT ${props.RT} RW ${props.RW}. Using default color.`
    ); // Log jika tidak ada data dominan
  }

  return {
    fillColor: fillColor,
    weight: 1,
    color: "#000",
    fillOpacity: opacity,
  };
}

// --- Fungsi render chart yang telah diperbarui ---
function renderChart(dataKey, chartType) {
  if (
    !processedChartData[dataKey] ||
    processedChartData[dataKey].values.reduce((a, b) => a + b, 0) === 0
  ) {
    if (currentChart) currentChart.destroy();
    const ctx = document.getElementById("pekerjaanChart").getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = "16px 'Poppins', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Tidak ada data untuk ditampilkan.",
      ctx.canvas.width / 2,
      ctx.canvas.height / 2
    );
    return;
  }

  if (currentChart) currentChart.destroy();
  const ctx = document.getElementById("pekerjaanChart").getContext("2d");
  // Ambil semua data yang dibutuhkan, termasuk array 'colors' yang mungkin ada
  const { labels, values, title, colors } = processedChartData[dataKey];
  console.log(
    `Rendering chart for ${dataKey}: Labels:`,
    labels,
    "Values:",
    values,
    "Colors:",
    colors
  ); // Log data chart

  const finalChartType = chartType === "pie" ? "doughnut" : "bar";

  currentChart = new Chart(ctx, {
    type: finalChartType,
    data: {
      labels: labels,
      datasets: [
        {
          label: title,
          data: values,
          // Gunakan 'colors' jika ada, jika tidak, gunakan palet warna default
          backgroundColor: colors ? colors : chartColors,
          borderWidth: finalChartType === "doughnut" ? 2 : 1,
          borderColor: "#fff",
          borderRadius: finalChartType === "bar" ? 5 : 0,
          hoverOffset: finalChartType === "doughnut" ? 15 : 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1200,
        easing: "easeInOutQuart",
      },
      plugins: {
        legend: {
          display: finalChartType === "doughnut",
          position: "right",
          labels: {
            font: { size: 10, family: "'Poppins', sans-serif" },
            boxWidth: 15,
            padding: 10,
          },
        },
        title: {
          display: true,
          text: title,
          font: { size: 14, family: "'Poppins', sans-serif", weight: "500" },
          color: "#343a40",
        },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleFont: { size: 14, family: "'Poppins', sans-serif" },
          bodyFont: { size: 12, family: "'Poppins', sans-serif" },
          padding: 10,
          cornerRadius: 5,
          displayColors: true,
          boxPadding: 4,
        },
      },
      scales: {
        x: {
          display: finalChartType === "bar",
          grid: { display: false },
        },
        y: {
          display: finalChartType === "bar",
          beginAtZero: true,
          grid: {
            color: "#e9ecef",
          },
        },
      },
    },
  });
}

// --- Fungsi untuk memproses data mentah menjadi format chart ---
function processDataForCharts(data) {
  const jenisKelaminCounts = {};
  const statusPekerjaanCounts = {};
  const umurCounts = {
    "< 17": 0,
    "17-25": 0,
    "26-35": 0,
    "36-45": 0,
    "46-55": 0,
    "> 55": 0,
    "Tidak Diketahui": 0,
  };

  data.forEach((item) => {
    let jk = (item.jenis_kelamin || "tidak diketahui").toLowerCase().trim();
    if (jk === "pria" || jk === "male") jk = "laki-laki";
    else if (jk === "wanita" || jk === "female") jk = "perempuan";
    jenisKelaminCounts[jk] = (jenisKelaminCounts[jk] || 0) + 1;

    const status = (item.status_pekerjaan_utama || "tidak diketahui")
      .toLowerCase()
      .trim();
    statusPekerjaanCounts[status] = (statusPekerjaanCounts[status] || 0) + 1;

    const umur = parseInt(item.umur, 10);
    if (isNaN(umur)) umurCounts["Tidak Diketahui"]++;
    else if (umur < 17) umurCounts["< 17"]++;
    else if (umur <= 25) umurCounts["17-25"]++;
    else if (umur <= 35) umurCounts["26-35"]++;
    else if (umur <= 45) umurCounts["36-45"]++;
    else if (umur <= 55) umurCounts["46-55"]++;
    else umurCounts["> 55"]++;
  });
  console.log("Processed Chart Data Counts:", {
    jenisKelaminCounts,
    statusPekerjaanCounts,
    umurCounts,
  }); // Log hasil hitungan

  // --- LOGIKA UNTUK WARNA JENIS KELAMIN ---
  const jkLabels = Object.keys(jenisKelaminCounts);
  const jkValues = Object.values(jenisKelaminCounts);
  // Buat array warna yang sesuai dengan urutan label
  const jkColors = jkLabels.map((label) => {
    switch (label.toLowerCase()) {
      case "laki-laki":
        return "#4361ee"; // Warna Biru
      case "perempuan":
        return "#f72585"; // Warna Pink/Magenta
      default:
        return "#adb5bd"; // Warna Abu-abu untuk data lain
    }
  });

  // Logika untuk menyorot pekerjaan dan umur paling banyak
  function highlightMostFrequent(counts, defaultColors) {
    let maxCount = 0;
    let mostFrequentLabel = "";

    // Temukan label dengan jumlah terbanyak
    for (const label in counts) {
      if (counts[label] > maxCount) {
        maxCount = counts[label];
        mostFrequentLabel = label;
      }
    }

    // Buat array warna baru, dengan warna merah gelap untuk yang paling banyak
    const highlightedColors = Object.keys(counts).map((label, index) => {
      if (
        label.toLowerCase() === mostFrequentLabel.toLowerCase() &&
        maxCount > 0
      ) {
        // Pastikan ada data untuk disorot
        return darkRedColor; // Warna merah gelap
      }
      return defaultColors[index % defaultColors.length]; // Gunakan warna default lainnya
    });
    return highlightedColors;
  }

  const statusPekerjaanLabels = Object.keys(statusPekerjaanCounts);
  const statusPekerjaanValues = Object.values(statusPekerjaanCounts);
  const highlightedStatusPekerjaanColors = highlightMostFrequent(
    statusPekerjaanCounts,
    chartColors
  );
  console.log(
    "Highlighted Status Pekerjaan Colors:",
    highlightedStatusPekerjaanColors
  ); // Log warna status pekerjaan

  const umurLabels = Object.keys(umurCounts);
  const umurValues = Object.values(umurCounts);
  const highlightedUmurColors = highlightMostFrequent(umurCounts, chartColors);
  console.log("Highlighted Umur Colors:", highlightedUmurColors); // Log warna umur

  return {
    jenisKelamin: {
      labels: jkLabels.map((l) => l.replace(/\b\w/g, (s) => s.toUpperCase())),
      values: jkValues,
      // Sertakan array warna yang sudah dibuat
      colors: jkColors,
      title: "Distribusi Jenis Kelamin",
    },
    statusPekerjaan: {
      labels: statusPekerjaanLabels.map((l) =>
        l.replace(/\b\w/g, (s) => s.toUpperCase())
      ),
      values: statusPekerjaanValues,
      colors: highlightedStatusPekerjaanColors, // Gunakan warna yang disorot
      title: "Distribusi Status Pekerjaan",
    },
    umur: {
      labels: umurLabels,
      values: umurValues,
      title: "Distribusi Kelompok Umur",
      colors: highlightedUmurColors, // Gunakan warna yang disorot
    },
  };
}

function updateTableView() {
  const tableBody = document.getElementById("pekerjaan-table-body");
  const noDataMessage = document.getElementById("no-data-message");
  tableBody.innerHTML = "";

  if (allRawData.length === 0) {
    noDataMessage.classList.remove("hidden");
  } else {
    noDataMessage.classList.add("hidden");
  }

  allRawData.forEach((item) => {
    let jkDisplay = (item.jenis_kelamin || "N/A").toLowerCase().trim();
    if (jkDisplay === "pria" || jkDisplay === "male") jkDisplay = "Laki-laki";
    if (jkDisplay === "wanita" || jkDisplay === "female")
      jkDisplay = "Perempuan";

    const statusDisplay = (item.status_pekerjaan_utama || "N/A").replace(
      /\b\w/g,
      (s) => s.toUpperCase()
    );

    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${item.rt || "N/A"}</td>
            <td>${item.rw || "N/A"}</td>
            <td>${item.umur || "N/A"}</td>
            <td>${jkDisplay}</td>
            <td>${statusDisplay}</td>
        `;
    tableBody.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  fetchDataAndUpdateViews();

  const dataSelectorButtons = document.querySelectorAll(
    ".data-selector-button"
  );
  const chartTypeButtons = document.querySelectorAll(".chart-type-button");
  const toggleButton = document.getElementById("toggle-data-table-button");
  const closeButton = document.getElementById("close-data-table-button");
  const dataTableContainer = document.getElementById("data-table-container");
  const resetButton = document.getElementById("reset-view-button");

  dataSelectorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      dataSelectorButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      currentDataKey = button.dataset.dataKey;
      renderChart(currentDataKey, currentChartType);
    });
  });

  chartTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      chartTypeButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      currentChartType = button.dataset.chartType;
      renderChart(currentDataKey, currentChartType);
    });
  });

  resetButton.addEventListener("click", () => {
    if (selectedLayer) {
      // Jika ada layer yang terpilih, reset warnanya ke warna dominasi default
      geoLayerGlobal.resetStyle(selectedLayer); // Gunakan geoLayerGlobal
      selectedLayer = null; // Hapus referensi layer terpilih
    }
    fetchDataAndUpdateViews(); // Ambil data untuk seluruh desa
    document.getElementById("selected-area-title").textContent =
      "Data Seluruh Desa";
  });

  toggleButton.addEventListener("click", () =>
    dataTableContainer.classList.remove("hidden")
  );
  closeButton.addEventListener("click", () =>
    dataTableContainer.classList.add("hidden")
  );
});
