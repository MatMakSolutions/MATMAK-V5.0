import { sFetch } from "../uof/Globals";
import { UserSettingsResponse } from "../data/models/UserSettingResponse";

export async function loadUserSettings() {
  try {
    const userSettings = await sFetch<UserSettingsResponse>("user/settings", "GET", null, true);
    
    if (userSettings) {
      // Store roll types in window for global access
      (window as any).userRollData = userSettings.update_preference_request.user_roll_types;
      (window as any).userCurrency = userSettings.update_preference_request.currency;
      (window as any).userUnitOfMeasure = userSettings.update_preference_request.unit_of_measure;
      
      console.log("User settings loaded:", {
        rollTypes: userSettings.update_preference_request.user_roll_types,
        currency: userSettings.update_preference_request.currency,
        unitOfMeasure: userSettings.update_preference_request.unit_of_measure
      });
    }
  } catch (error) {
    console.error("Failed to load user settings:", error);
  }
}

export async function updateUserCurrency(currency: number) {
  try {
    // First get current settings
    const currentSettings = await sFetch<UserSettingsResponse>("user/settings", "GET", null, true);
    
    if (currentSettings) {
      // Update the currency in the settings
      currentSettings.update_preference_request.currency = currency;
      
      // Send the updated settings back
      const response = await sFetch("user/settings", "POST", currentSettings.update_preference_request, true);
      
      if (response) {
        (window as any).userCurrency = currency;
        console.log("Currency updated to:", currency);
      }
      return response;
    }
    return null;
  } catch (error) {
    console.error("Failed to update currency:", error);
    return null;
  }
}

export function getCurrencySymbol(currencyId?: number): string {
  const id = currencyId || (window as any).userCurrency || 1;
  switch(id) {
    case 1: return "$";
    case 2: return "€";
    case 3: return "£";
    case 4: return "¥";
    default: return "$";
  }
}

export function getCurrencyName(currencyId?: number): string {
  const id = currencyId || (window as any).userCurrency || 1;
  switch(id) {
    case 1: return "USD";
    case 2: return "EUR";
    case 3: return "GBP";
    case 4: return "JPY";
    default: return "USD";
  }
}