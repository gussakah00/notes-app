class ServiceWorkerManager {
  constructor() {
    this.registration = null;
    this.isActive = false;
  }

  async init() {
    // Cek browser support
    if (!("serviceWorker" in navigator)) {
      console.log("❌ Service Worker tidak didukung browser ini");
      return false;
    }

    try {
      console.log("🚀 Mengaktifkan Service Worker...");

      // Unregister SW lama yang bermasalah
      await this.cleanupOldSW();

      // Register SW baru
      await this.registerSW();

      // Setup auto update
      this.setupAutoUpdate();

      console.log("✅ Service Worker berhasil diaktifkan");
      return true;
    } catch (error) {
      console.error("❌ Gagal mengaktifkan Service Worker:", error);
      return false;
    }
  }

  async cleanupOldSW() {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      if (registrations.length === 0) {
        console.log("ℹ️ Tidak ada Service Worker lama");
        return;
      }

      console.log(
        `🗑️ Membersihkan ${registrations.length} Service Worker lama...`
      );

      const unregisterPromises = registrations.map(async (registration) => {
        try {
          await registration.unregister();
          console.log("✅ Berhasil unregister SW:", registration.scope);
          return true;
        } catch (error) {
          console.error("❌ Gagal unregister SW:", error);
          return false;
        }
      });

      await Promise.all(unregisterPromises);
      console.log("✅ Semua Service Worker lama dibersihkan");
    } catch (error) {
      console.error("❌ Error saat membersihkan SW lama:", error);
    }
  }

  async registerSW() {
    try {
      // Tentukan URL SW berdasarkan environment
      const swUrl = this.getSWUrl();
      console.log("📁 Registering Service Worker:", swUrl);

      // Register Service Worker dengan scope yang benar
      this.registration = await navigator.serviceWorker.register(swUrl, {
        scope: this.getSWScope(), // ✅ PERBAIKAN: Scope yang benar
        updateViaCache: "none",
      });

      console.log("✅ Service Worker terdaftar:", this.registration.scope);

      // Tunggu sampai SW aktif
      await this.waitForActivation();

      return this.registration;
    } catch (error) {
      console.error("❌ Gagal register Service Worker:", error);
      throw error;
    }
  }

  getSWUrl() {
    // Development - gunakan SW sederhana
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return "/sw.js";
    }

    // Production - GitHub Pages
    const isGitHubPages = window.location.hostname.includes("github.io");
    if (isGitHubPages) {
      // Ambil nama repo dari pathname
      const pathSegments = window.location.pathname
        .split("/")
        .filter((segment) => segment);
      const repoName = pathSegments[0] || "notes-app";

      // ✅ FIX: Gunakan path absolut dengan repo name
      return `/${repoName}/sw.js`;
    }

    // Default untuk production
    return "/sw.js";
  }

  getSWScope() {
    // Tentukan scope berdasarkan environment
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return "/"; // ✅ Scope root di localhost
    }

    // GitHub Pages - scope harus sesuai dengan base path
    const isGitHubPages = window.location.hostname.includes("github.io");
    if (isGitHubPages) {
      const pathSegments = window.location.pathname
        .split("/")
        .filter((segment) => segment);
      const repoName = pathSegments[0] || "notes-app";

      // ✅ FIX: Scope harus /repo-name/
      return `/${repoName}/`;
    }

    return "/"; // Default scope
  }

  async waitForActivation() {
    return new Promise((resolve, reject) => {
      if (!this.registration) {
        reject(new Error("No registration found"));
        return;
      }

      // Jika sudah aktif
      if (this.registration.active) {
        this.isActive = true;
        console.log("🎉 Service Worker sudah aktif");
        resolve(this.registration);
        return;
      }

      // Jika masih installing, tunggu sampai aktif
      const installingWorker = this.registration.installing;

      if (installingWorker) {
        installingWorker.addEventListener("statechange", () => {
          console.log(`🔄 Status Service Worker: ${installingWorker.state}`);

          if (installingWorker.state === "activated") {
            this.isActive = true;
            console.log("🎉 Service Worker berhasil diaktifkan!");
            resolve(this.registration);
          }

          if (installingWorker.state === "redundant") {
            reject(new Error("Service Worker menjadi redundant"));
          }
        });
      } else {
        // Listen untuk updatefound
        this.registration.addEventListener("updatefound", () => {
          const newWorker = this.registration.installing;
          console.log("🔄 Service Worker baru ditemukan:", newWorker.state);

          newWorker.addEventListener("statechange", () => {
            console.log(`🔄 Status SW baru: ${newWorker.state}`);

            if (newWorker.state === "activated") {
              this.isActive = true;
              console.log("🎉 Service Worker baru diaktifkan!");
              resolve(this.registration);
            }
          });
        });
      }

      // Timeout setelah 10 detik
      setTimeout(() => {
        if (!this.isActive) {
          reject(new Error("Service Worker activation timeout"));
        }
      }, 10000);
    });
  }

  setupAutoUpdate() {
    if (!this.registration) return;

    // Check for updates setiap 1 jam
    setInterval(async () => {
      try {
        console.log("🔍 Memeriksa update Service Worker...");
        await this.registration.update();
        console.log("✅ Update check selesai");
      } catch (error) {
        console.error("❌ Gagal check update:", error);
      }
    }, 60 * 60 * 1000); // 1 jam

    // Listen untuk controller change
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("🔄 Controller Service Worker berubah");
      this.isActive = true;

      // ✅ Tampilkan pesan update tersedia
      if (this.isUpdateAvailable) {
        console.log(
          "🔄 Update tersedia! Refresh halaman untuk mendapatkan versi terbaru."
        );
        this.showUpdateNotification();
      }
    });
  }

  showUpdateNotification() {
    // Optional: Tampilkan UI notification
    if (typeof window.showUpdateNotification === "function") {
      window.showUpdateNotification();
    }
  }

  async forceUpdate() {
    if (!this.registration) {
      console.log("❌ Tidak ada Service Worker yang terdaftar");
      return false;
    }

    try {
      console.log("🔄 Memaksa update Service Worker...");
      await this.registration.update();
      console.log("✅ Force update berhasil");
      return true;
    } catch (error) {
      console.error("❌ Gagal force update:", error);
      return false;
    }
  }

  async unregister() {
    try {
      await this.cleanupOldSW();
      this.registration = null;
      this.isActive = false;
      console.log("✅ Semua Service Worker di-unregister");
      return true;
    } catch (error) {
      console.error("❌ Gagal unregister:", error);
      return false;
    }
  }

  getStatus() {
    return {
      isActive: this.isActive,
      scope: this.registration?.scope || null,
      controller: navigator.serviceWorker.controller ? true : false,
    };
  }
}

// Buat instance global
const swManager = new ServiceWorkerManager();

// Export untuk digunakan di modul lain
export const registerSW = () => swManager.init();
export const forceUpdate = () => swManager.forceUpdate();
export const unregisterSW = () => swManager.unregister();
export const getSWStatus = () => swManager.getStatus();

// Auto init ketika module di-load
if (typeof window !== "undefined") {
  // Tunggu sampai DOM ready + additional delay untuk stability
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => {
        console.log("🚀 Initializing Service Worker...");
        swManager.init().then((success) => {
          if (success) {
            console.log("🎉 Service Worker initialization completed");
          } else {
            console.log("⚠️ Service Worker initialization failed");
          }
        });
      }, 2000); // ✅ Delay lebih lama untuk stability
    });
  } else {
    setTimeout(() => {
      console.log("🚀 Initializing Service Worker...");
      swManager.init().then((success) => {
        if (success) {
          console.log("🎉 Service Worker initialization completed");
        } else {
          console.log("⚠️ Service Worker initialization failed");
        }
      });
    }, 2000);
  }
}

console.log("🚀 Service Worker Manager loaded");
