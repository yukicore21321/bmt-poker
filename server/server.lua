local ESX = exports["es_extended"]:getSharedObject()

local TotalPot = 500000 -- Giá trị khởi tạo mặc định
local JackpotPercentage = 0.05 -- 5% tiền cược được vào hũ

-- Hàm thông báo debug (nếu cần)
local function debugLog(msg)
    if Config.Debug then
        print('^3[BMT Poker Server]^7 ' .. msg)
    end
end

-- ==========================================
-- Callbacks
-- ==========================================

-- Lấy số tiền của người chơi
ESX.RegisterServerCallback('bmt_poker:getMoney', function(source, cb)
    local xPlayer = ESX.GetPlayerFromId(source)
    if xPlayer then
        local money = xPlayer.getAccount(Config.Account).money
        cb(money)
    else
        cb(0)
    end
end)

-- Lấy giá trị hũ hiện tại
ESX.RegisterServerCallback('bmt_poker:getPot', function(source, cb)
    cb(math.floor(TotalPot))
end)

-- ==========================================
-- Logic Game Poker
-- ==========================================

-- Tạo bộ bài và lấy 5 lá ngẫu nhiên
local function GenerateHand()
    local deck = {}
    for suit = 0, 3 do
        for value = 1, 13 do
            table.insert(deck, {suit = suit, value = value})
        end
    end
    
    -- Tráo bài (Fisher-Yates)
    for i = #deck, 2, -1 do
        local j = math.random(i)
        deck[i], deck[j] = deck[j], deck[i]
    end
    
    local hand = {}
    for i = 1, 5 do
        table.insert(hand, deck[i])
    end
    
    return hand
end

-- Đánh giá tay bài
local function EvaluateHand(hand)
    local values = {}
    local suits = {}
    local counts = {}
    
    for _, card in ipairs(hand) do
        table.insert(values, card.value)
        table.insert(suits, card.suit)
        counts[card.value] = (counts[card.value] or 0) + 1
    end
    
    table.sort(values)
    
    -- Kiểm tra Thùng (Flush)
    local isFlush = true
    for i = 2, 5 do
        if suits[i] ~= suits[1] then
            isFlush = false
            break
        end
    end
    
    -- Kiểm tra Sảnh (Straight)
    local isStraight = false
    -- Sảnh thường: 5 lá liên tiếp
    if values[5] - values[1] == 4 and #counts == 5 then
        isStraight = true
    end
    -- Sảnh chúa (10, J, Q, K, A): 1, 10, 11, 12, 13
    if not isStraight and values[1] == 1 and values[2] == 10 and values[3] == 11 and values[4] == 12 and values[5] == 13 then
        isStraight = true
    end
    
    -- Đếm các bộ (Đôi, Ba, Tứ)
    local quad = false
    local triple = false
    local pairCount = 0
    
    for v, count in pairs(counts) do
        if count == 4 then quad = true
        elseif count == 3 then triple = true
        elseif count == 2 then pairCount = pairCount + 1
        end
    end
    
    -- Phân loại kết quả
    if isFlush and isStraight then
        -- Royal Flush (10, J, Q, K, A)
        if values[1] == 1 and values[2] == 10 then
            return 'royal_flush'
        end
        return 'straight_flush'
    end
    
    if quad then return 'four_kind' end
    if triple and pairCount == 1 then return 'full_house' end
    if isFlush then return 'flush' end
    if isStraight then return 'straight' end
    if triple then return 'three_kind' end
    if pairCount == 2 then return 'two_pair' end
    if pairCount == 1 then return 'pair' end
    
    return 'high_card'
end

-- ==========================================
-- Events
-- ==========================================

RegisterNetEvent('bmt_poker:spin', function(betAmount)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    
    if not xPlayer then return end
    
    -- Kiểm tra số tiền cược hợp lệ
    betAmount = tonumber(betAmount)
    if not betAmount or betAmount < Config.MinBet or betAmount > Config.MaxBet then
        TriggerClientEvent('bmt_poker:notify', src, 'Số tiền cược không hợp lệ!')
        return
    end
    
    -- Kiểm tra số dư
    local playerMoney = xPlayer.getAccount(Config.Account).money
    if playerMoney < betAmount then
        TriggerClientEvent('bmt_poker:notify', src, 'Bạn không đủ tiền!')
        return
    end
    
    -- Trừ tiền và thêm vào hũ
    xPlayer.removeAccountMoney(Config.Account, betAmount)
    TotalPot = TotalPot + (betAmount * JackpotPercentage)
    TriggerClientEvent('bmt_poker:updatePot', -1, math.floor(TotalPot))
    
    debugLog('Player ' .. xPlayer.getName() .. ' bet ' .. betAmount)
    
    -- Sinh kết quả
    local hand = GenerateHand()
    local result = EvaluateHand(hand)
    
    -- Trả kết quả về client để chạy animation
    TriggerClientEvent('bmt_poker:result', src, hand)
    
    -- Chờ animation card quay (theo script.js là khoảng 2.5s)
    SetTimeout(2500, function()
        local multiplier = Config.Payouts[result] or 0
        
        if multiplier > 0 then
            local winAmount = math.floor(betAmount * multiplier)
            
            -- Xử lý Jackpot cho Royal Flush (Tùy chọn: Thưởng thêm 1 phần hũ)
            if result == 'royal_flush' then
                local jackpotBonus = math.floor(TotalPot * 0.5) -- Thưởng 50% hũ
                winAmount = winAmount + jackpotBonus
                TotalPot = TotalPot - jackpotBonus
                TriggerClientEvent('bmt_poker:updatePot', -1, math.floor(TotalPot))
                
                -- Thông báo toàn server
                TriggerClientEvent('bmt_poker:jackpot', -1, {
                    playerName = xPlayer.getName(),
                    hand = 'ROYAL FLUSH',
                    amount = winAmount
                })
            elseif multiplier >= 50 then -- Thông báo cho các giải lớn (Flush trở lên)
                TriggerClientEvent('bmt_poker:jackpot', -1, {
                    playerName = xPlayer.getName(),
                    hand = result:gsub("_", " "):upper(),
                    amount = winAmount
                })
            end
            
            xPlayer.addAccountMoney(Config.Account, winAmount)
            TriggerClientEvent('bmt_poker:win', src, {
                hand = result,
                amount = winAmount,
                multiplier = multiplier
            })
            debugLog('Player won: ' .. winAmount .. ' (Multiplier: ' .. multiplier .. ')')
        else
            TriggerClientEvent('bmt_poker:lose', src, result)
            debugLog('Player lost with: ' .. result)
        end
    end)
end)

print('^2[BMT Poker]^7 Server started successfully')
