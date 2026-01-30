const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Cette option permet de gérer correctement les fichiers de certaines bibliothèques comme Supabase
config.resolver.sourceExts.push('mjs');

module.exports = config;
