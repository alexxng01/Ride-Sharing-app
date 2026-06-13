// src/lib/api.js
// API service for ride history

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const USE_MOCK_API = true; // Set to false if you have a real API

// Local storage fallback
const getLocalHistory = () => {
  const history = localStorage.getItem('rideHistory');
  return history ? JSON.parse(history) : [];
};

const saveLocalHistory = (history) => {
  localStorage.setItem('rideHistory', JSON.stringify(history));
};

export const rideHistoryApi = {
  // Get all rides
  getAll: async () => {
    if (USE_MOCK_API) {
      // Return local storage data
      return getLocalHistory();
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/rides`);
      if (!response.ok) throw new Error('Failed to fetch rides');
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      // Fallback to local storage
      return getLocalHistory();
    }
  },

  // Get single ride
  getById: async (id) => {
    if (USE_MOCK_API) {
      const history = getLocalHistory();
      return history.find(ride => ride.id === id || ride.rideId === id) || null;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/rides/${id}`);
      if (!response.ok) throw new Error('Failed to fetch ride');
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      const history = getLocalHistory();
      return history.find(ride => ride.id === id || ride.rideId === id) || null;
    }
  },

  // Create new ride
  create: async (rideData) => {
    if (USE_MOCK_API) {
      const history = getLocalHistory();
      const newRide = {
        ...rideData,
        id: rideData.rideId || Date.now().toString(),
        createdAt: rideData.createdAt || new Date().toISOString(),
      };
      history.unshift(newRide);
      saveLocalHistory(history);
      return newRide;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rideData),
      });
      if (!response.ok) throw new Error('Failed to create ride');
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      // Save to local storage as fallback
      const history = getLocalHistory();
      const newRide = {
        ...rideData,
        id: rideData.rideId || Date.now().toString(),
        createdAt: rideData.createdAt || new Date().toISOString(),
      };
      history.unshift(newRide);
      saveLocalHistory(history);
      return newRide;
    }
  },

  // Update ride
  update: async (id, rideData) => {
    if (USE_MOCK_API) {
      const history = getLocalHistory();
      const index = history.findIndex(ride => ride.id === id || ride.rideId === id);
      if (index !== -1) {
        history[index] = { ...history[index], ...rideData };
        saveLocalHistory(history);
        return history[index];
      }
      return null;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/rides/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rideData),
      });
      if (!response.ok) throw new Error('Failed to update ride');
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      return null;
    }
  },

  // Delete ride
  delete: async (id) => {
    if (USE_MOCK_API) {
      const history = getLocalHistory();
      const filtered = history.filter(ride => ride.id !== id && ride.rideId !== id);
      saveLocalHistory(filtered);
      return true;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/rides/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete ride');
      return true;
    } catch (error) {
      console.error('API Error:', error);
      return false;
    }
  },

  // Clear all history
  clearAll: async () => {
    if (USE_MOCK_API) {
      localStorage.removeItem('rideHistory');
      return true;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/rides`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to clear rides');
      return true;
    } catch (error) {
      console.error('API Error:', error);
      return false;
    }
  },
};