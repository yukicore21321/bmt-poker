import { useState, useEffect, useRef } from 'react'
import './App.css'

// ===== NUI HELPERS =====
const isFiveM = window.location.protocol === 'https:' && window.location.hostname.includes('cfx-nui');
const debugMode = !isFiveM;

function debug(msg) {
    if (debugMode) {
        console.log('[BMT Poker] ' + msg);
    }
}

const post = (url, data) => {
    if (!isFiveM) {
        debug(`[Test Mode] Would send to server: ${url} ${JSON.stringify(data)}`);
        return Promise.resolve({ json: () => Promise.resolve({}) });
    }
    const resourceName = window.location.hostname.replace('cfx-nui-', '');
    return fetch(`https://${resourceName}/${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
};

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

function App() {
    const [visible, setVisible] = useState(debugMode);
    const [pot, setPot] = useState(0);
    const [betAmount, setBetAmount] = useState(5000);
    const [isSpinning, setIsSpinning] = useState(false);
    const [autoSpin, setAutoSpin] = useState(false);
    const [soundOn, setSoundOn] = useState(localStorage.getItem("soundState") !== "off");
    
    const [cards, setCards] = useState([
        { suit: 0, value: 0, isSpinning: false, stopAnim: false },
        { suit: 0, value: 0, isSpinning: false, stopAnim: false },
        { suit: 0, value: 0, isSpinning: false, stopAnim: false },
        { suit: 0, value: 0, isSpinning: false, stopAnim: false },
        { suit: 0, value: 0, isSpinning: false, stopAnim: false }
    ]);

    // Dragging state
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const gameRef = useRef(null);

    // Audio refs
    const spinSoundRef = useRef(null);
    const winSoundRef = useRef(null);

    // Auto spin interval
    const intervalRef = useRef(null);

    useEffect(() => {
        const handleMessage = (event) => {
            const data = event.data;
            debug(`NUI Message: ${JSON.stringify(data)}`);

            switch (data.action) {
                case 'open':
                    setVisible(true);
                    if (data.config) {
                        setBetAmount(data.config.defaultBet || 5000);
                    }
                    updatePot();
                    break;
                case 'close':
                    closeUI();
                    break;
                case 'result':
                    displayResult(data.hand);
                    break;
                case 'win':
                    handleWin(data.data);
                    break;
                case 'lose':
                    handleLose(data.result);
                    break;
                case 'updatePot':
                    setPot(data.pot);
                    break;
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeUI();
            }
        };

        window.addEventListener('message', handleMessage);
        window.addEventListener('keydown', handleKeyDown);

        if (debugMode) {
            updatePot();
        }

        return () => {
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Auto spin effect
    useEffect(() => {
        if (autoSpin) {
            intervalRef.current = setInterval(() => {
                if (!isSpinning) spinOnce();
            }, 3000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [autoSpin, isSpinning]);

    const updatePot = () => {
        post('getPot', {})
            .then(response => response.json())
            .then(potAmount => {
                if (potAmount !== undefined && potAmount !== null && typeof potAmount === 'number') {
                    setPot(potAmount);
                } else if (debugMode) {
                    setPot(500000);
                }
            })
            .catch(err => {
                debug(`Failed to get pot: ${err}`);
                if (debugMode) setPot(500000);
            });
    };

    const closeUI = () => {
        setVisible(false);
        setAutoSpin(false);
        setIsSpinning(false);
        setDragPos({ x: 0, y: 0 });
        post('close', {}).catch(() => { });
    };

    const minimizeUI = () => {
        setVisible(false);
        setDragPos({ x: 0, y: 0 });
        post('minimize', {}).catch(() => { });
    };

    const spinOnce = () => {
        if (isSpinning) return;

        setIsSpinning(true);
        debug(`Starting spin with bet: ${betAmount}`);

        if (debugMode) {
            // Mock result for debug
            setTimeout(() => {
                const testHands = [
                    [{ suit: 0, value: 9 }, { suit: 0, value: 10 }, { suit: 0, value: 11 }, { suit: 0, value: 12 }, { suit: 0, value: 13 }], // Royal
                    [{ suit: 2, value: 2 }, { suit: 1, value: 5 }, { suit: 0, value: 9 }, { suit: 3, value: 11 }, { suit: 1, value: 13 }] // High Card
                ];
                const randomHand = testHands[Math.floor(Math.random() * testHands.length)];
                displayResult(randomHand);
                
                setTimeout(() => {
                    setIsSpinning(false);
                }, 2500);
            }, 500);
            return;
        }

        post('spin', { betAmount: betAmount })
            .catch((err) => {
                debug(`Spin request failed: ${err}`);
                setIsSpinning(false);
            });

        // Safety timeout
        setTimeout(() => {
            setIsSpinning(false);
        }, 5000);
    };

    // Sync muted property manually to ensure it updates correctly
    useEffect(() => {
        if (spinSoundRef.current) {
            spinSoundRef.current.muted = !soundOn;
            spinSoundRef.current.volume = 1.0;
        }
        if (winSoundRef.current) {
            winSoundRef.current.muted = !soundOn;
            winSoundRef.current.volume = 1.0;
        }
    }, [soundOn]);

    const displayResult = (hand) => {
        debug(`Displaying result, soundOn: ${soundOn}, spinSoundRef: ${!!spinSoundRef.current}`);
        if (soundOn && spinSoundRef.current) {
            spinSoundRef.current.currentTime = 0;
            spinSoundRef.current.play()
                .then(() => debug('Spin sound playing successfully'))
                .catch(e => debug('Spin sound play failed: ' + e));
        }

        // Start spinning animation
        setCards(prev => prev.map(c => ({ ...c, isSpinning: true, stopAnim: false })));

        setTimeout(() => {
            hand.forEach((card, index) => {
                setTimeout(() => {
                    setCards(prev => {
                        const newCards = [...prev];
                        newCards[index] = { 
                            suit: card.suit, 
                            value: card.value, 
                            isSpinning: false, 
                            stopAnim: true 
                        };
                        return newCards;
                    });

                    // Remove stop animation class after a while
                    setTimeout(() => {
                        setCards(prev => {
                            const newCards = [...prev];
                            newCards[index].stopAnim = false;
                            return newCards;
                        });
                    }, 300);

                }, index * 200);
            });
        }, 800);
    };

    const handleWin = (data) => {
        setIsSpinning(false);
        debug(`Handle win, soundOn: ${soundOn}, winSoundRef: ${!!winSoundRef.current}`);
        if (soundOn && winSoundRef.current) {
            winSoundRef.current.currentTime = 0;
            winSoundRef.current.play()
                .then(() => debug('Win sound playing successfully'))
                .catch(e => debug('Win sound play failed: ' + e));
        }

        post('showWin', {
            handName: handNames[data.hand] || data.hand,
            amount: data.amount,
            multiplier: data.multiplier
        }).catch(() => { });
    };

    const handleLose = (result) => {
        setIsSpinning(false);
        post('showWin', {
            handName: handNames[result] || result,
            amount: 0,
            multiplier: 0,
            isLoss: true
        }).catch(() => { });
    };

    const toggleSound = () => {
        const newState = !soundOn;
        debug(`Toggling sound to: ${newState}`);
        setSoundOn(newState);
        localStorage.setItem("soundState", newState ? "on" : "off");
    };

    // Dragging handlers
    const onMouseDown = (e) => {
        // Skip if clicking buttons
        if (['spinBtn', 'autoBtn', 'stopBtn', 'soundBtn', 'closeBtn'].includes(e.target.id)) return;
        
        isDragging.current = true;
        dragStartPos.current = {
            x: e.clientX - dragPos.x,
            y: e.clientY - dragPos.y
        };
    };

    useEffect(() => {
        const onMouseMove = (e) => {
            if (!isDragging.current) return;
            setDragPos({
                x: e.clientX - dragStartPos.current.x,
                y: e.clientY - dragStartPos.current.y
            });
        };

        const onMouseUp = () => {
            isDragging.current = false;
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [dragPos]);

    if (!visible) return null;

    return (
        <div id="gameContainer" className="active">
            <div 
                id="game" 
                ref={gameRef}
                onMouseDown={onMouseDown}
                style={{ transform: `translate(${dragPos.x}px, ${dragPos.y}px)` }}
            >
                <img id="hud" src="images/hud.png" alt="HUD" />
                <img 
                    id="closeBtn" 
                    src="images/exit.png" 
                    alt="Close" 
                    onClick={minimizeUI}
                />
                
                <div id="betPanel">
                    <img id="quyImg" src="images/quy.png" alt="Pot" />
                    <span id="potAmount">{pot.toLocaleString('en-US')}</span>
                </div>

                <div className="cards">
                    {cards.map((card, index) => (
                        <img 
                            key={index}
                            id={`c${index + 1}`}
                            className={`${card.isSpinning ? 'spinning' : ''} ${card.stopAnim ? 'stopAnim' : ''}`}
                            src={card.value === 0 ? "card/back.png" : `card/${card.suit}_${card.value}.png`} 
                            alt={`Card ${index + 1}`}
                        />
                    ))}
                </div>

                <img 
                    id="spinBtn" 
                    src="images/quay.png" 
                    alt="Quay" 
                    onClick={() => !autoSpin && !isSpinning && spinOnce()}
                />
                <img 
                    id="autoBtn" 
                    src="images/autoquay.png" 
                    alt="Auto Quay" 
                    onClick={() => !autoSpin && setAutoSpin(true)}
                />
                <img 
                    id="stopBtn" 
                    src="images/stop.png" 
                    alt="Stop" 
                    onClick={() => setAutoSpin(false)}
                />
                <img 
                    id="soundBtn" 
                    src={soundOn ? "images/soud.png" : "images/mute.png"} 
                    alt="Sound" 
                    onClick={toggleSound}
                />
            </div>

            <audio ref={spinSoundRef} src="sounds/soudquay.mp3" preload="auto"></audio>
            <audio ref={winSoundRef} src="sounds/soudwin.mp3" preload="auto"></audio>
        </div>
    )
}

export default App
