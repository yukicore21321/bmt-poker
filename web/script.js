// ===== NUI HELPERS =====
const debugMode = window.location.protocol === 'https:' ? false : true; // Debug khi test locally

function debug(msg) {
    if (debugMode) {
        console.log('[BMT Poker] ' + msg);
    }
}

// Ngắn chặn console.log khi không ở debug mode
if (!debugMode) {
    console.log = function () { };
    console.error = function () { };
    console.warn = function () { };
}

function post(url, data) {
    // Kiểm tra xem có đang chạy trong FiveM không
    const isFiveM = window.location.protocol === 'https:' && window.location.hostname.includes('cfx-nui');

    if (!isFiveM) {
        console.log('[Test Mode] Would send to server:', url, data);
        return Promise.resolve();
    }

    // Lấy resource name từ hostname (cfx-nui-RESOURCENAME)
    const resourceName = window.location.hostname.replace('cfx-nui-', '');
    const fetchUrl = `https://${resourceName}/${url}`;

    console.log('[BMT Poker] Posting to:', fetchUrl, 'with data:', data);

    return fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

// ===== WAIT FOR DOM =====
window.addEventListener('DOMContentLoaded', function () {
    initGame();
});

function initGame() {
    let betAmount = 5000;
    let pot = 0;
    let autoSpin = false;
    let interval;
    let isSpinning = false;

    const gameContainer = document.getElementById("gameContainer");
    const game = document.getElementById("game");
    const potDisplay = document.getElementById("potAmount");
    const soundBtn = document.getElementById("soundBtn");
    const closeBtn = document.getElementById("closeBtn");

    // ===== DRAGGABLE HUD =====
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    game.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        // Không kéo nếu click vào button
        if (e.target.id === 'spinBtn' || e.target.id === 'autoBtn' ||
            e.target.id === 'stopBtn' || e.target.id === 'soundBtn' ||
            e.target.id === 'closeBtn') {
            return;
        }

        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;

        if (e.target === game || e.target.id === 'hud') {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, game);
        }
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    const cardElements = [
        document.getElementById("c1"),
        document.getElementById("c2"),
        document.getElementById("c3"),
        document.getElementById("c4"),
        document.getElementById("c5")
    ];

    const spinSound = document.getElementById("spinSound");
    const winSound = document.getElementById("winSound");

    /* ===== TRẠNG THÁI ÂM THANH ===== */
    let soundOn = localStorage.getItem("soundState") !== "off";

    updateSoundUI();

    function updateSoundUI() {
        spinSound.muted = !soundOn;
        winSound.muted = !soundOn;
        soundBtn.src = soundOn ? "images/soud.png" : "images/mute.png";
    }

    soundBtn.onclick = function () {
        soundOn = !soundOn;
        localStorage.setItem("soundState", soundOn ? "on" : "off");
        updateSoundUI();
    };

    /* ===== CLOSE ===== */
    closeBtn.onclick = function () {
        // Chỉ ẩn UI, không dừng auto spin
        gameContainer.classList.remove('active');

        // Reset vị trí drag về mặc định
        xOffset = 0;
        yOffset = 0;
        game.style.transform = 'translate(0px, 0px)';

        // Gọi về client để tắt NUI focus (dùng minimize thay vì close)
        post('minimize', {}).catch(() => { });
    };

    function closeUI() {
        gameContainer.classList.remove('active');
        // Dừng hoàn toàn khi ESC hoặc đóng thật
        autoSpin = false;
        isSpinning = false;
        clearInterval(interval);

        // Reset vị trí drag về mặc định
        xOffset = 0;
        yOffset = 0;
        game.style.transform = 'translate(0px, 0px)';

        post('close', {}).catch(() => { });
    }

    // ESC to close (đóng thật)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeUI();
        }
    });

    /* ===== CẬP NHẬT QUỸ ===== */
    function updatePot() {
        post('getPot', {})
            .then(response => response.json())
            .then(potAmount => {
                pot = potAmount;
                potDisplay.innerText = potAmount.toLocaleString('en-US');
                console.log('[BMT Poker] Pot updated:', potAmount);
            })
            .catch(err => {
                console.error('[BMT Poker] Failed to get pot:', err);
                // Test mode: set giá trị mẫu
                if (window.location.protocol === 'file:') {
                    pot = 500000;
                    potDisplay.innerText = pot.toLocaleString('en-US');
                }
            });
    }

    /* ===== NUI EVENTS ===== */
    window.addEventListener('message', function (event) {
        const data = event.data;
        console.log('[BMT Poker] NUI Message:', data);

        switch (data.action) {
            case 'open':
                console.log('[BMT Poker] Opening UI...');
                gameContainer.classList.add('active');
                if (data.config) {
                    betAmount = data.config.defaultBet || 5000;
                }
                // Cập nhật quỸ khi mở UI
                updatePot();
                break;

            case 'close':
                console.log('[BMT Poker] Closing UI...');
                gameContainer.classList.remove('active');
                autoSpin = false;
                clearInterval(interval);
                break;

            case 'result':
                console.log('[BMT Poker] Displaying cards:', data.hand);
                displayResult(data.hand);
                break;

            case 'win':
                console.log('[BMT Poker] Win event:', data.data);
                handleWin(data.data);
                break;

            case 'lose':
                console.log('[BMT Poker] Lose event:', data.result);
                handleLose(data.result);
                break;

            case 'updatePot':
                console.log('[BMT Poker] Pot update:', data.pot);
                pot = data.pot;
                potDisplay.innerText = data.pot.toLocaleString('en-US');
                break;
        }
    });

    /* ===== DISPLAY RESULT ===== */
    function displayResult(hand) {
        console.log('[BMT Poker] displayResult called with:', hand);

        if (soundOn) {
            spinSound.currentTime = 0;
            spinSound.play().catch(e => console.log('Sound play failed:', e));
        }

        cardElements.forEach(card => {
            card.classList.add("spinning");
        });

        setTimeout(() => {
            cardElements.forEach((card, index) => {
                setTimeout(() => {
                    const cardPath = `card/${hand[index].suit}_${hand[index].value}.png`;
                    console.log('[BMT Poker] Card', index, 'path:', cardPath);
                    card.src = cardPath;
                    card.classList.remove("spinning");
                    card.classList.add("stopAnim");

                    setTimeout(() => {
                        card.classList.remove("stopAnim");
                    }, 300);

                }, index * 200);
            });
        }, 800);
    }

    /* ===== HANDLE WIN ===== */
    function handleWin(data) {
        isSpinning = false;

        if (soundOn) {
            winSound.currentTime = 0;
            winSound.play().catch(e => console.log('Sound play failed:', e));
        }

        const handNames = {
            'royal_flush': 'Thùng Phá Sảnh Hoàng Gia',
            'straight_flush': 'Thùng Phá Sảnh',
            'four_kind': 'Tứ Quý',
            'full_house': 'Cù Lũ',
            'flush': 'Thùng',
            'straight': 'Sảnh',
            'three_kind': 'Ba Lá',
            'two_pair': 'Hai Đôi',
            'pair': 'Đôi'
        };

        console.log('[BMT Poker] Win!', data);

        // Gửi thông báo về client để hiển thị ESX notification
        post('showWin', {
            handName: handNames[data.hand] || data.hand,
            amount: data.amount,
            multiplier: data.multiplier
        }).catch(() => { });
    }

    /* ===== HANDLE LOSE ===== */
    function handleLose(result) {
        isSpinning = false;

        const handNames = {
            'royal_flush': 'Thùng Phá Sảnh Hoàng Gia',
            'straight_flush': 'Thùng Phá Sảnh',
            'four_kind': 'Tứ Quý',
            'full_house': 'Cù Lũ',
            'flush': 'Thùng',
            'straight': 'Sảnh',
            'three_kind': 'Ba Lá',
            'two_pair': 'Hai Đôi',
            'pair': 'Đôi',
            'high_card': 'Bài Cao'
        };

        console.log('[BMT Poker] Lose with:', result);

        // Gửi thông báo về client
        post('showWin', {
            handName: handNames[result] || result,
            amount: 0,
            multiplier: 0,
            isLoss: true
        }).catch(() => { });
    }

    /* ===== SPIN ===== */
    function spinOnce() {
        console.log('[BMT Poker] spinOnce called, isSpinning:', isSpinning);

        if (isSpinning) {
            console.log('[BMT Poker] Already spinning, skipping...');
            return;
        }

        isSpinning = true;
        console.log('[BMT Poker] Starting spin with bet:', betAmount);

        // Gửi request lên server qua client
        post('spin', { betAmount: betAmount })
            .then(() => {
                console.log('[BMT Poker] Spin request sent successfully');
            })
            .catch((err) => {
                console.error('[BMT Poker] Spin request failed:', err);
                isSpinning = false;
            });

        // Reset sau 3 giây
        setTimeout(() => {
            isSpinning = false;
            console.log('[BMT Poker] Spin cooldown complete');
        }, 3000);
    }

    /* ===== BUTTONS ===== */
    const spinBtn = document.getElementById("spinBtn");
    const autoBtn = document.getElementById("autoBtn");
    const stopBtn = document.getElementById("stopBtn");

    console.log('[BMT Poker] Buttons initialized:', { spinBtn, autoBtn, stopBtn });

    spinBtn.onclick = () => {
        console.log('[BMT Poker] Spin clicked!');
        if (!autoSpin && !isSpinning) {
            spinOnce();
        }
    };

    autoBtn.onclick = () => {
        console.log('[BMT Poker] Auto clicked!');
        if (!autoSpin) {
            autoSpin = true;
            spinOnce();
            interval = setInterval(() => {
                if (!isSpinning) spinOnce();
            }, 3000);
        }
    };

    stopBtn.onclick = () => {
        console.log('[BMT Poker] Stop clicked!');
        autoSpin = false;
        clearInterval(interval);
    };

    // ===== TEST MODE =====
    // Chỉ chạy khi test ngoài FiveM
    if (window.location.protocol === 'file:') {
        console.log('[TEST MODE] Running outside FiveM');
        console.log('[TEST MODE] Protocol:', window.location.protocol);
        setTimeout(() => {
            gameContainer.classList.add('active');
            console.log('[TEST MODE] UI opened - Click QUAY để test!');
        }, 500);

        // Override spinOnce để test UI với random cards
        spinOnce = function () {
            if (isSpinning) return;

            isSpinning = true;
            console.log('[TEST MODE] Spinning...');

            // Giả lập random cards (các tay bài khác nhau)
            const testHands = [
                // Royal Flush
                [{ suit: 0, value: 9 }, { suit: 0, value: 10 }, { suit: 0, value: 11 }, { suit: 0, value: 12 }, { suit: 0, value: 13 }],
                // Straight Flush
                [{ suit: 1, value: 5 }, { suit: 1, value: 6 }, { suit: 1, value: 7 }, { suit: 1, value: 8 }, { suit: 1, value: 9 }],
                // Four of a Kind
                [{ suit: 0, value: 7 }, { suit: 1, value: 7 }, { suit: 2, value: 7 }, { suit: 3, value: 7 }, { suit: 0, value: 3 }],
                // Full House
                [{ suit: 0, value: 9 }, { suit: 1, value: 9 }, { suit: 2, value: 9 }, { suit: 0, value: 4 }, { suit: 1, value: 4 }],
                // Flush
                [{ suit: 2, value: 2 }, { suit: 2, value: 5 }, { suit: 2, value: 7 }, { suit: 2, value: 10 }, { suit: 2, value: 13 }],
                // Straight
                [{ suit: 0, value: 4 }, { suit: 1, value: 5 }, { suit: 2, value: 6 }, { suit: 3, value: 7 }, { suit: 0, value: 8 }],
                // Three of a Kind
                [{ suit: 0, value: 7 }, { suit: 1, value: 7 }, { suit: 2, value: 7 }, { suit: 0, value: 2 }, { suit: 1, value: 13 }],
                // Two Pair
                [{ suit: 0, value: 1 }, { suit: 1, value: 1 }, { suit: 0, value: 3 }, { suit: 1, value: 3 }, { suit: 2, value: 7 }],
                // Pair
                [{ suit: 0, value: 12 }, { suit: 1, value: 12 }, { suit: 0, value: 4 }, { suit: 1, value: 8 }, { suit: 2, value: 2 }],
                // No match
                [{ suit: 0, value: 2 }, { suit: 1, value: 5 }, { suit: 2, value: 9 }, { suit: 3, value: 11 }, { suit: 0, value: 13 }]
            ];

            const randomHand = testHands[Math.floor(Math.random() * testHands.length)];

            displayResult(randomHand);

            setTimeout(() => {
                isSpinning = false;
                console.log('[TEST MODE] Spin hoàn tất');
            }, 2500);
        };
    } else {
        console.log('[BMT Poker] Running in FiveM mode');
        console.log('[BMT Poker] Protocol:', window.location.protocol);
        console.log('[BMT Poker] Hostname:', window.location.hostname);
    }

} // End initGame()
