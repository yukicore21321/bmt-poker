ESX = exports["es_extended"]:getSharedObject()

local isPokerOpen = false
local currentPot = 0
local debugMode = Config.Debug or false

local function debugLog(msg)
    if debugMode then
        print('^2[BMT Poker Client]^7 ' .. msg)
    end
end

-- Mở UI Poker
function OpenPoker()
    if isPokerOpen then 
        debugLog('UI already open')
        return 
    end
    
    debugLog('Opening poker UI...')
    
    isPokerOpen = true
    SetNuiFocus(true, true)
    
    debugLog('SetNuiFocus set to true')
    
    SendNUIMessage({
        action = 'open',
        config = {
            minBet = Config.MinBet,
            maxBet = Config.MaxBet,
            defaultBet = Config.DefaultBet
        }
    })
    
    debugLog('Sent NUI message to open UI')
    
    -- Animation
    if Config.AnimDict and Config.AnimName then
        RequestAnimDict(Config.AnimDict)
        while not HasAnimDictLoaded(Config.AnimDict) do
            Wait(100)
        end
        TaskPlayAnim(PlayerPedId(), Config.AnimDict, Config.AnimName, 8.0, -8.0, -1, 1, 0, false, false, false)
        debugLog('Started animation')
    end
end

-- Đóng UI Poker
function ClosePoker()
    if not isPokerOpen then return end
    
    isPokerOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({
        action = 'close'
    })
    
    -- Dừng animation
    ClearPedTasks(PlayerPedId())
end

-- NUI Callback: Đóng UI
RegisterNUICallback('close', function(data, cb)
    debugLog('NUI Callback: close')
    ClosePoker()
    cb('ok')
end)

-- NUI Callback: Minimize UI (ẩn UI nhưng giữ auto spin)
RegisterNUICallback('minimize', function(data, cb)
    debugLog('NUI Callback: minimize')
    -- Chỉ tắt NUI focus, không đóng UI hoàn toàn
    isPokerOpen = false  -- Cho phép mở lại UI
    SetNuiFocus(false, false)
    cb('ok')
end)

-- NUI Callback: Quay (spin)
RegisterNUICallback('spin', function(data, cb)
    debugLog('===== NUI Callback: spin =====' )
    debugLog('Data received: ' .. json.encode(data))
    
    local betAmount = data.betAmount or Config.DefaultBet
    
    debugLog('Player spinning with bet: ' .. betAmount)
    
    -- Gửi request lên server
    TriggerServerEvent('bmt_poker:spin', betAmount)
    
    debugLog('Event sent to server')
    
    cb('ok')
end)

-- NUI Callback: Lấy số dư
RegisterNUICallback('getMoney', function(data, cb)
    debugLog('NUI Callback: getMoney')
    ESX.TriggerServerCallback('bmt_poker:getMoney', function(money)
        debugLog('Player money: ' .. money)
        cb(money)
    end)
end)

-- NUI Callback: Lấy số tiền quỹ
RegisterNUICallback('getPot', function(data, cb)
    debugLog('NUI Callback: getPot')
    ESX.TriggerServerCallback('bmt_poker:getPot', function(pot)
        debugLog('Total pot: ' .. pot)
        cb(pot)
    end)
end)

-- NUI Callback: Hiển thị thông báo thắng
RegisterNUICallback('showWin', function(data, cb)
    debugLog('NUI Callback: showWin')
    debugLog('Hand: ' .. data.handName .. ', Amount: ' .. data.amount .. ', Multiplier: ' .. data.multiplier)
    
    if data.isLoss then
        ESX.ShowNotification(
            '❌ Bạn đã thua !\n' ..
            '🃏 Bài của bạn: ' .. data.handName
        )
    else
        ESX.ShowNotification(
            '🎉 ' .. data.handName .. '\n' ..
            '💰 Thắng: $' .. ESX.Math.GroupDigits(data.amount) .. ' (x' .. data.multiplier .. ')'
        )
    end
    
    cb('ok')
end)

-- Event: Nhận kết quả từ server
RegisterNetEvent('bmt_poker:result', function(hand)
    debugLog('Received result from server: ' .. json.encode(hand))
    
    SendNUIMessage({
        action = 'result',
        hand = hand
    })
end)

-- Event: Thắng
RegisterNetEvent('bmt_poker:win', function(data)
    SendNUIMessage({
        action = 'win',
        data = data
    })
end)

-- Event: Thua
RegisterNetEvent('bmt_poker:lose', function(result)
    SendNUIMessage({
        action = 'lose',
        result = result
    })
end)

-- Event: Cập nhật quỹ
RegisterNetEvent('bmt_poker:updatePot', function(pot)
    debugLog('Pot updated: ' .. pot)
    SendNUIMessage({
        action = 'updatePot',
        pot = pot
    })
end)

-- Event: Thông báo
RegisterNetEvent('bmt_poker:notify', function(message, type)
    ESX.ShowNotification(message)
end)

-- Event: Thông báo jackpot (toàn server)
RegisterNetEvent('bmt_poker:jackpot', function(data)
    ESX.ShowNotification(
        '⚡ NỔ HŨ POKER !⚡\n' ..
        '' .. data.playerName .. ' vừa trúng ~g~' .. data.hand .. ' !\n' ..
        '💰 Thắng: $' .. ESX.Math.GroupDigits(data.amount)
    )
end)

-- Command mở poker
if Config.UseCommand then
    RegisterCommand(Config.CommandName, function(source, args, rawCommand)
        OpenPoker()
    end, false)
end

-- Marker và Blip tại các vị trí
if Config.UseMarker or Config.UseBlip then
    CreateThread(function()
        -- Tạo blip
        if Config.UseBlip then
            for _, location in ipairs(Config.PokerLocations) do
                local blip = AddBlipForCoord(location.x, location.y, location.z)
                SetBlipSprite(blip, Config.BlipSprite)
                SetBlipDisplay(blip, Config.BlipDisplay)
                SetBlipScale(blip, Config.BlipScale)
                SetBlipColour(blip, Config.BlipColour)
                SetBlipAsShortRange(blip, true)
                BeginTextCommandSetBlipName('STRING')
                AddTextComponentSubstringPlayerName(location.label)
                EndTextCommandSetBlipName(blip)
            end
        end
        
        -- Loop marker
        while true do
            local sleep = 1000
            
            if Config.UseMarker then
                local playerCoords = GetEntityCoords(PlayerPedId())
                
                for _, location in ipairs(Config.PokerLocations) do
                    local distance = #(playerCoords - vector3(location.x, location.y, location.z))
                    
                    if distance < Config.DrawDistance then
                        sleep = 0
                        DrawMarker(
                            Config.MarkerType,
                            location.x, location.y, location.z - 1.0,
                            0.0, 0.0, 0.0,
                            0.0, 0.0, 0.0,
                            Config.MarkerSize.x, Config.MarkerSize.y, Config.MarkerSize.z,
                            Config.MarkerColor.r, Config.MarkerColor.g, Config.MarkerColor.b, 100,
                            false, true, 2, false, nil, nil, false
                        )
                        
                        if distance < Config.InteractDistance then
                            ESX.ShowHelpNotification('Nhấn ~INPUT_CONTEXT~ để chơi Mini Poker')
                            
                            if IsControlJustReleased(0, 38) then -- E
                                OpenPoker()
                            end
                        end
                    end
                end
            end
            
            Wait(sleep)
        end
    end)
end

-- ESC để đóng
CreateThread(function()
    while true do
        Wait(0)
        if isPokerOpen then
            DisableControlAction(0, 1, true)   -- Mouse
            DisableControlAction(0, 2, true)   -- Mouse
            DisableControlAction(0, 142, true) -- MWheelUp
            DisableControlAction(0, 18, true)  -- Enter
            DisableControlAction(0, 322, true) -- ESC
            DisableControlAction(0, 106, true) -- VehicleMouseControlOverride
            
            if IsDisabledControlJustReleased(0, 322) then -- ESC
                ClosePoker()
            end
        else
            Wait(500)
        end
    end
end)

if debugMode then
    print('^2[BMT Poker]^7 Client started successfully (Debug: ON)')
else
    print('^2[BMT Poker]^7 Client started successfully (Debug: OFF)')
end
