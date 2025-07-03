// dashboard.js

document.addEventListener("DOMContentLoaded", function () {
  const tableBody = document.getElementById("data-table-body");
  const modal = document.getElementById("form-modal");
  const tambahBtn = document.getElementById("tambah-data-btn");
  const closeBtn = document.querySelector(".close-button");
  const dataForm = document.getElementById("data-form");
  const modalTitle = document.getElementById("modal-title");
  const dataIdInput = document.getElementById("data-id");

  // Input fields in the modal
  const rtInput = document.getElementById("rt");
  const rwInput = document.getElementById("rw");
  const namaInput = document.getElementById("nama_anggota"); // Perubahan di sini
  const umurInput = document.getElementById("umur");
  const jenisKelaminInput = document.getElementById("jenis_kelamin");
  const statusPekerjaanInput = document.getElementById("status_pekerjaan");

  const apiUrl = "/api/contoh";

  async function fetchAndRenderData() {
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Gagal mengambil data");

      const data = await response.json();
      tableBody.innerHTML = "";

      if (data.length === 0) {
        // Perubahan di sini: ubah colspan menjadi 7
        tableBody.innerHTML =
          '<tr><td colspan="7" style="text-align: center;">Tidak ada data.</td></tr>';
        return;
      }

      data.forEach((item) => {
        // Perubahan di sini: tambahkan <td> untuk nama_anggota
        const row = `
            <tr>
                <td>${item.rt}</td>
                <td>${item.rw}</td>
                <td>${item.nama_anggota}</td>
                <td>${item.umur}</td>
                <td>${item.jenis_kelamin}</td>
                <td>${item.status_pekerjaan_utama}</td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${item._id}">Edit</button>
                    <button class="delete-btn" data-id="${item._id}">Hapus</button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
      });
    } catch (error) {
      console.error("Error:", error);
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">${error.message}</td></tr>`;
    }
  }

  function openModal(mode, data = null) {
    dataForm.reset();
    if (mode === "add") {
      modalTitle.textContent = "Tambah Data Baru";
      dataIdInput.value = "";
    } else if (mode === "edit" && data) {
      modalTitle.textContent = "Edit Data";
      dataIdInput.value = data._id;
      rtInput.value = data.rt;
      rwInput.value = data.rw;
      namaInput.value = data.nama_anggota; // Perubahan di sini
      umurInput.value = data.umur;
      jenisKelaminInput.value = data.jenis_kelamin;
      statusPekerjaanInput.value = data.status_pekerjaan_utama;
    }
    modal.style.display = "block";
  }

  // ... (fungsi closeModal tetap sama) ...
  function closeModal() {
    modal.style.display = "none";
  }

  tambahBtn.addEventListener("click", () => openModal("add"));
  closeBtn.addEventListener("click", closeModal);
  window.addEventListener("click", (event) => {
    if (event.target == modal) closeModal();
  });

  dataForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const id = dataIdInput.value;
    const isEditMode = !!id;

    // Perubahan di sini: tambahkan nama_anggota ke formData
    const formData = {
      rt: rtInput.value,
      rw: rwInput.value,
      nama_anggota: namaInput.value,
      umur: umurInput.value,
      jenis_kelamin: jenisKelaminInput.value,
      status_pekerjaan_utama: statusPekerjaanInput.value,
    };

    // Perubahan di sini: tambahkan validasi untuk nama_anggota
    if (
      !formData.rt ||
      !formData.rw ||
      !formData.nama_anggota ||
      !formData.umur ||
      !formData.jenis_kelamin ||
      !formData.status_pekerjaan_utama
    ) {
      alert("Semua field harus diisi!");
      return;
    }

    const url = isEditMode ? `${apiUrl}/${id}` : apiUrl;
    const method = isEditMode ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Terjadi kesalahan");

      alert(result.message);
      closeModal();
      fetchAndRenderData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });

  // ... (event listener untuk Edit dan Hapus tetap sama) ...
  tableBody.addEventListener("click", async function (event) {
    const target = event.target;
    const id = target.dataset.id;

    if (target.classList.contains("edit-btn")) {
      try {
        const res = await fetch(apiUrl);
        const allData = await res.json();
        const itemToEdit = allData.find((item) => item._id === id);
        if (itemToEdit) {
          openModal("edit", itemToEdit);
        } else {
          alert("Data tidak ditemukan lagi. Mungkin sudah dihapus.");
        }
      } catch (error) {
        alert("Gagal mengambil data untuk diedit.");
      }
    }

    if (target.classList.contains("delete-btn")) {
      if (confirm("Apakah Anda yakin ingin menghapus data ini?")) {
        try {
          const response = await fetch(`${apiUrl}/${id}`, { method: "DELETE" });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          alert(result.message);
          fetchAndRenderData();
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
      }
    }
  });

  fetchAndRenderData();
});
