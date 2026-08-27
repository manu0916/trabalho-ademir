// Background Service Worker for Kicks Store Importer

chrome.runtime.onInstalled.addListener(() => {
  console.log('Kicks Store Sneaker Importer instalado com sucesso.');
  
  // Set default settings if not configured
  chrome.storage.local.get(['apiUrl'], (result) => {
    if (!result.apiUrl) {
      chrome.storage.local.set({
        apiUrl: 'http://localhost:8080',
        defaultStock: 10,
        defaultCategory: 'Basquete'
      });
    }
  });
});
