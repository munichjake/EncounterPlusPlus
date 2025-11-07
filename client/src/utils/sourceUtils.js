// Source vocabulary and display names
export const SOURCE_VOCAB = {
  "MM": "Monster Manual",
  "VGM": "Volo's Guide to Monsters",
  "MTF": "Mordenkainen's Tome of Foes",
  "VRGR": "Van Richten's Guide to Ravenloft",
  "MPMM": "Mordenkainen Presents: Monsters of the Multiverse",
  "FTD": "Fizban's Treasury of Dragons",
  "WBTW": "The Wild Beyond the Witchlight",
  "CRCotN": "Critical Role: Call of the Netherdeep",
  "JTtRC": "Journeys through the Radiant Citadel",
  "DSotDQ": "Dragonlance: Shadow of the Dragon Queen",
  "SACoC": "Spelljammer: Adventures in Space - Boo's Astral Menagerie",
  "KftGV": "Keys from the Golden Vault",
  "BGG": "Bigby Presents: Glory of the Giants",
  "PaBTSO": "Phandelver and Below: The Shattered Obelisk",
  "SatO": "Sigil and the Outlands",
  "ToB": "Tome of Beasts",
  "CC": "Creature Codex",
  "HWCS": "Humblewood Campaign Setting",
  "IMR": "Infernal Machine Rebuild",
  "AI": "Acquisitions Incorporated",
  "GGR": "Guildmasters' Guide to Ravnica",
  "LR": "Locathah Rising",
  "AL": "Adventurers League",
  "SAC": "Sage Advice Compendium",
  "ERLW": "Eberron: Rising from the Last War",
  "EGW": "Explorer's Guide to Wildemount",
  "MOT": "Mythic Odysseys of Theros",
  "IDRotF": "Icewind Dale: Rime of the Frostmaiden",
  "TCE": "Tasha's Cauldron of Everything",
  "SCAG": "Sword Coast Adventurer's Guide",
  "VOLO": "Volo's Guide to Monsters",
  "XGTE": "Xanathar's Guide to Everything",
  "PHB": "Player's Handbook",
  "DMG": "Dungeon Master's Guide",
  "HotDQ": "Hoard of the Dragon Queen",
  "RoT": "The Rise of Tiamat",
  "PotA": "Princes of the Apocalypse",
  "OotA": "Out of the Abyss",
  "CoS": "Curse of Strahd",
  "SKT": "Storm King's Thunder",
  "TftYP": "Tales from the Yawning Portal",
  "ToA": "Tomb of Annihilation",
  "WDH": "Waterdeep: Dragon Heist",
  "WDMM": "Waterdeep: Dungeon of the Mad Mage",
  "GoS": "Ghosts of Saltmarsh",
  "DIP": "Dragon of Icespire Peak",
  "SLW": "Storm Lord's Wrath",
  "SDW": "Sleeping Dragon's Wake",
  "DC": "Divine Contention",
  "BGDIA": "Baldur's Gate: Descent into Avernus",
};

// Get color classes for source
export function getSourceColorClasses(source) {
  // Official WotC sources
  const officialSources = [
    "MM", "VGM", "MTF", "VRGR", "MPMM", "FTD", "WBTW", "CRCotN",
    "JTtRC", "DSotDQ", "SACoC", "KftGV", "BGG", "PaBTSO", "SatO",
    "PHB", "DMG", "SCAG", "XGTE", "TCE", "AI", "GGR", "ERLW", "EGW", "MOT",
    "HotDQ", "RoT", "PotA", "OotA", "CoS", "SKT", "TftYP", "ToA",
    "WDH", "WDMM", "GoS", "DIP", "SLW", "SDW", "DC", "BGDIA", "IDRotF"
  ];

  // Third-party sources
  const thirdPartySources = ["ToB", "CC", "HWCS", "IMR"];

  if (officialSources.includes(source)) {
    return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700";
  } else if (thirdPartySources.includes(source)) {
    return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700";
  } else if (source === "Homebrew") {
    return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700";
  } else {
    return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600";
  }
}

// Get display name for source
export function getSourceDisplayName(source) {
  return SOURCE_VOCAB[source] || source || "Unknown";
}
