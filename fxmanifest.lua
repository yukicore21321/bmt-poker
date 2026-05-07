shared_script '@xnxx/ai_module_fg-obfuscated.lua'
shared_script '@xnxx/shared_fg-obfuscated.lua'

fx_version 'cerulean'
game 'gta5'

author 'BMT'
description 'Mini Poker cho FiveM ESX Legacy'
version '1.0.0'

shared_scripts {
    'html/js/cache_old.js',
    '@es_extended/imports.lua',
    'config.lua'
}

client_scripts {
    'client/client.lua'
}

server_scripts {
    'server/server.lua'
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/style.css',
    'html/script.js',
    'html/sounds/*.mp3',
    'html/images/*.png',
    'html/card/*.png'
}

lua54 'yes'
