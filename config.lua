Config = {}

-- Cấu hình chung
Config.Locale = 'vi'
Config.Debug = false         -- Bật/tắt debug log (F8 console)

-- Cấu hình game
Config.MinBet = 200          -- Số tiền cược tối thiểu mỗi lượt
Config.MaxBet = 200         -- Số tiền cược tối đa mỗi lượt
Config.DefaultBet = 200      -- Số tiền cược mặc định

-- Hệ số nhân thưởng cho từng tay bài (luat poker chuan)
Config.Payouts = {
    -- ['pair'] = 2,              -- Doi (Tỉ lệ ra đôi quá nhiều, không tính nữa)
    ['two_pair'] = 8,             -- Hai đôi
    ['three_kind'] = 16,          -- Ba lá (2.11% cơ hội)
    ['straight'] = 32,            -- Sảnh (0.39% cơ hội)
    ['flush'] = 50,               -- Thùng (0.20% cơ hội)
    ['full_house'] = 60,          -- Cù lũ (0.14% cơ hội)
    ['four_kind'] = 150,          -- Tứ quý (0.024% cơ hội)
    ['straight_flush'] = 500,     -- Thùng phá sảnh (0.0014% cơ hội)
    ['royal_flush'] = 2000        -- Royal Flush (0.00015% cơ hội)
}

-- Vị trí mở UI (tọa độ Casino hoặc vị trí tùy chỉnh)
Config.PokerLocations = {
    {x = 1111.0, y = 229.0, z = -50.0, heading = 0.0, label = "Mini Poker"}, -- Diamond Casino
}

-- Sử dụng marker tại vị trí
Config.UseMarker = true
Config.MarkerType = 1
Config.MarkerSize = {x = 1.5, y = 1.5, z = 1.0}
Config.MarkerColor = {r = 255, g = 215, b = 0}

-- Sử dụng command để mở
Config.UseCommand = true
Config.CommandName = 'poker'

-- Sử dụng blip trên map
Config.UseBlip = false
Config.BlipSprite = 617        -- Icon máy slot
Config.BlipDisplay = 4
Config.BlipScale = 0.8
Config.BlipColour = 5

-- Tài khoản ESX để trừ tiền
Config.Account = 'money'       -- 'money', 'bank', hoặc 'black_money'

-- Khoảng cách tương tác
Config.DrawDistance = 10.0
Config.InteractDistance = 2.0

-- Animation khi chơi
Config.AnimDict = 'amb@world_human_slot_machine@female@idle_a'
Config.AnimName = 'idle_a'
