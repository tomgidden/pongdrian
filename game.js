class Player {
    constructor(playerId, keyConfig, columnX, gameHeight, paddleConfig) {
        this.playerId = playerId;
        this.isAI = true;
        this.serveDirection = playerId === 1 ? 1 : -1;
        
        this.keyConfig = {
            up: keyConfig.up,
            down: keyConfig.down,
            ai: keyConfig.ai
        };
        
        this.paddle = {
            y: gameHeight / 2 - paddleConfig.height / 2,
            height: paddleConfig.height,
            width: paddleConfig.width,
            speed: paddleConfig.speed,
            columnX: columnX,
            minY: paddleConfig.buffer,
            maxY: gameHeight - paddleConfig.buffer - paddleConfig.height
        };
        
        this.ai = {
            reactionTime: 150,
            lastDecisionTime: 0,
            targetY: gameHeight / 2,
            mistakeProbability: 0.08,
            nextMistakeTime: 0
        };
    }
    
    handleInput(keys, keyDebounce, currentTime, servingPlayer, waitingForServe, onServe) {
        // Handle AI control toggle
        if (keys[this.keyConfig.ai] && currentTime > keyDebounce[this.keyConfig.ai]) {
            this.isAI = true;
            if (waitingForServe && servingPlayer !== this.playerId) {
                onServe();
            }
        }
        
        // Handle up movement
        if (keys[this.keyConfig.up] && currentTime > keyDebounce[this.keyConfig.up]) {
            this.isAI = false;
            if (this.paddle.y > this.paddle.minY) {
                this.paddle.y -= this.paddle.speed;
            }
            if (waitingForServe && servingPlayer !== this.playerId) {
                onServe();
            }
        }
        
        // Handle down movement  
        if (keys[this.keyConfig.down] && currentTime > keyDebounce[this.keyConfig.down]) {
            this.isAI = false;
            if (this.paddle.y < this.paddle.maxY) {
                this.paddle.y += this.paddle.speed;
            }
            if (waitingForServe && servingPlayer !== this.playerId) {
                onServe();
            }
        }
    }
    
    updateAI(ball, currentTime, servingPlayer, waitingForServe, onServe) {
        if (!this.isAI) return;
        
        const paddleCenter = this.paddle.y + this.paddle.height / 2;
        
        if (currentTime - this.ai.lastDecisionTime > this.ai.reactionTime) {
            let shouldMakeMistake = false;
            
            if (currentTime > this.ai.nextMistakeTime) {
                shouldMakeMistake = Math.random() < this.ai.mistakeProbability;
                this.ai.nextMistakeTime = currentTime + Math.random() * 4000 + 2000;
            }

            if (shouldMakeMistake) {
                this.ai.targetY = ball.y + (Math.random() - 0.5) * 200;
            } else {
                this.ai.targetY = ball.y;
            }
            
            if (waitingForServe && servingPlayer !== this.playerId) {
                onServe();
            }
            
            this.ai.lastDecisionTime = currentTime;
        }

        const targetCenter = this.ai.targetY;
        const diff = targetCenter - paddleCenter;
        const threshold = 10;

        if (Math.abs(diff) > threshold) {
            if (diff > 0 && this.paddle.y < this.paddle.maxY) {
                this.paddle.y += this.paddle.speed;
            } else if (diff < 0 && this.paddle.y > this.paddle.minY) {
                this.paddle.y -= this.paddle.speed;
            }
        }
    }
    
    update(keys, keyDebounce, ball, currentTime, servingPlayer, waitingForServe, onServe) {
        this.handleInput(keys, keyDebounce, currentTime, servingPlayer, waitingForServe, onServe);
        this.updateAI(ball, currentTime, servingPlayer, waitingForServe, onServe);
    }
    
    render(ctx, gridlineThickness, gameHeight) {
        const lineOffset = gridlineThickness / 2;
        const paddleWidth = this.paddle.width;
        
        // Draw white blocks above and below paddle
        ctx.fillStyle = '#ffffff';
        if (this.paddle.y > 0) {
            ctx.fillRect(this.paddle.columnX + lineOffset, lineOffset, 
                        paddleWidth - gridlineThickness, this.paddle.y - lineOffset);
        }
        if (this.paddle.y + this.paddle.height < gameHeight) {
            ctx.fillRect(this.paddle.columnX + lineOffset, this.paddle.y + this.paddle.height, 
                        paddleWidth - gridlineThickness, 
                        gameHeight - this.paddle.y - this.paddle.height - lineOffset);
        }
        
        // Draw blue paddle
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(this.paddle.columnX, this.paddle.y, paddleWidth, this.paddle.height);
        
        // Draw paddle column gridlines
        ctx.strokeStyle = '#000';
        ctx.lineWidth = gridlineThickness;
        ctx.strokeRect(this.paddle.columnX, 0, paddleWidth, gameHeight);
        
        // Draw segment borders
        if (this.paddle.y > 0) {
            ctx.strokeRect(this.paddle.columnX, 0, paddleWidth, this.paddle.y);
        }
        ctx.strokeRect(this.paddle.columnX, this.paddle.y, paddleWidth, this.paddle.height);
        if (this.paddle.y + this.paddle.height < gameHeight) {
            ctx.strokeRect(this.paddle.columnX, this.paddle.y + this.paddle.height, 
                          paddleWidth, gameHeight - this.paddle.y - this.paddle.height);
        }
    }
    
    checkCollision(ball, ballSize) {
        const movingTowardsPaddle = this.playerId === 1 ? ball.velocityX < 0 : ball.velocityX > 0;
        
        if (movingTowardsPaddle && 
            ((this.playerId === 1 && ball.x - ballSize/2 <= this.paddle.columnX + this.paddle.width) ||
             (this.playerId === 2 && ball.x + ballSize/2 >= this.paddle.columnX)) &&
            ball.x + ballSize/2 >= this.paddle.columnX &&
            ball.x - ballSize/2 <= this.paddle.columnX + this.paddle.width &&
            ball.y >= this.paddle.y &&
            ball.y <= this.paddle.y + this.paddle.height) {
            
            ball.velocityX = -ball.velocityX;
            ball.velocityY += (ball.y - (this.paddle.y + this.paddle.height / 2)) * 0.1;
            return true;
        }
        return false;
    }
    
    resetAI() {
        this.ai.lastDecisionTime = Date.now();
        this.ai.targetY = this.paddle.y + this.paddle.height / 2;
        this.ai.nextMistakeTime = Date.now() + Math.random() * 3000 + 2000;
    }
    
    getServePosition(serveOffset) {
        const ballX = this.playerId === 1 
            ? this.paddle.columnX + this.paddle.width + serveOffset
            : this.paddle.columnX - serveOffset;
        const ballY = this.paddle.y + this.paddle.height / 2;
        
        return { x: ballX, y: ballY };
    }
}

class Pongdriaan {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.player1ScoreEl = document.getElementById('player1Score');
        this.player2ScoreEl = document.getElementById('player2Score');
        this.controlsTextEl = document.getElementById('controlsText');

        this.gameWidth = this.canvas.width;
        this.gameHeight = this.canvas.height;

        this.keyConfig = {
            player1Up: 'Q',
            player1Down: 'A',
            player1AI: 'Z',

            player2Up: 'O',
            player2Down: 'K',
            player2AI: 'M',

            difficultyEasy: '1',
            difficultyMedium: '2',
            difficultyHard: '3'
        };

        this.gameState = 'playing';
        this.keys = {};

        this.keyDebounce = Object.fromEntries(
            Object.values(this.keyConfig).map(key => [key, 0])
        );

        this.servingPlayer = 1;
        this.waitingForServe = false;
        this.serveOffset = 20;

        this.gridlineThickness = 6;
        this.ballSize = 2 * this.gridlineThickness;

        this.ball = {
            x: this.gameWidth / 2,
            y: this.gameHeight / 2,
            velocityX: 5,
            velocityY: 3,
            speed: 5
        };

        const paddleConfig = {
            width: this.ballSize * 2 + this.gridlineThickness*2,
            height: this.ballSize * 16,
            speed: 8,
            buffer: this.ballSize * 2
        };

        this.players = [
            new Player(1, {
                up: this.keyConfig.player1Up,
                down: this.keyConfig.player1Down,
                ai: this.keyConfig.player1AI
            }, 60, this.gameHeight, paddleConfig),
            
            new Player(2, {
                up: this.keyConfig.player2Up,
                down: this.keyConfig.player2Down,
                ai: this.keyConfig.player2AI
            }, this.gameWidth - 70, this.gameHeight, paddleConfig)
        ];

        this.score = {
            player1: 0,
            player2: 0
        };

        // Update #controlsText
        this.controlsTextEl.textContent = `
        Press ${this.keyConfig.player1Up}/${this.keyConfig.player1Down}, or 
        ${this.keyConfig.player2Up}/${this.keyConfig.player2Down} to control a paddle; and ${this.keyConfig.player1AI} or ${this.keyConfig.player2AI} to hand control back to the AI.
        `;
        this.mondrianGrid = this.createMondrianGrid();

        this.init();
    }

    generateMondrianGrid(width, height) {
        const grid = [];
        const colors = ['#ffffff', '#dc2626', '#fbbf24'];
        const colorWeights = [0.7, 0.15, 0.15];
        
        const generateRandomDivisions = (total, count) => {
            const divisions = [0];
            const segments = [];
            
            for (let i = 1; i < count; i++) {
                const isWide = Math.random() < 0.25;
                const minSize = isWide ? Math.floor(total * 0.25) : Math.floor(total * 0.03);
                const maxSize = isWide ? Math.floor(total * 0.5) : Math.floor(total * 0.08);
                segments.push(minSize + Math.random() * (maxSize - minSize));
            }
            
            const totalSegments = segments.reduce((a, b) => a + b, 0);
            const scale = (total - divisions[0]) / totalSegments;
            
            for (let i = 0; i < segments.length; i++) {
                divisions.push(Math.floor(divisions[divisions.length - 1] + segments[i] * scale));
            }
            
            divisions.push(total);
            return divisions.sort((a, b) => a - b);
        };
        
        let verticalDivisions = generateRandomDivisions(width, 8);
        this.players.forEach(player => {
            verticalDivisions.push(player.paddle.columnX, player.paddle.columnX + player.paddle.width);
        });
        verticalDivisions = [...new Set(verticalDivisions)].sort((a, b) => a - b);
        
        const horizontalDivisions = generateRandomDivisions(height, 7);
        
        for (let i = 0; i < verticalDivisions.length - 1; i++) {
            for (let j = 0; j < horizontalDivisions.length - 1; j++) {
                const x = verticalDivisions[i];
                const y = horizontalDivisions[j];
                const rectWidth = verticalDivisions[i + 1] - x;
                const rectHeight = horizontalDivisions[j + 1] - y;
                
                if (rectWidth > 0 && rectHeight > 0) {
                    const isPaddleColumn = this.players.some(player => 
                        x === player.paddle.columnX && rectWidth === player.paddle.width
                    );
                    if (isPaddleColumn) {
                        continue;
                    }
                    
                    const random = Math.random();
                    let color = colors[0];
                    let cumWeight = 0;
                    
                    for (let k = 0; k < colors.length; k++) {
                        cumWeight += colorWeights[k];
                        if (random <= cumWeight) {
                            color = colors[k];
                            break;
                        }
                    }
                    
                    grid.push({
                        x: x,
                        y: y,
                        width: rectWidth,
                        height: rectHeight,
                        color: color
                    });
                }
            }
        }
        
        return grid;
    }

    createMondrianGrid() {
        return this.generateMondrianGrid(
            this.gameWidth,
            this.gameHeight
        );
    }

    init() {
        this.setupEventListeners();
        this.resetBall();
        this.resetAI();
        this.gameLoop();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toUpperCase()] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toUpperCase()] = false;
        });
    }


    resetBall() {
        this.waitingForServe = true;
        this.gameState = 'serving';
        
        const servingPlayer = this.players[this.servingPlayer - 1];
        const servePos = servingPlayer.getServePosition(this.serveOffset);
        
        this.ball.x = servePos.x;
        this.ball.y = servePos.y;
        this.ball.velocityX = this.ball.speed * servingPlayer.serveDirection;
        this.ball.velocityY = 0;
    }

    serveBall() {
        this.waitingForServe = false;
        this.gameState = 'playing';
        this.ball.velocityY = (1 + 0.2 * (Math.random() - 0.5)) * this.ball.speed;
    }

    resetAI() {
        this.players.forEach(player => player.resetAI());
    }

    update() {
        this.updatePaddles();
        
        if (this.gameState !== 'playing') return;

        this.updateBall();
        this.checkCollisions();
    }

    updatePaddles() {
        const currentTime = Date.now();

        this.players.forEach(player => {
            player.update(this.keys, this.keyDebounce, this.ball, currentTime, 
                         this.servingPlayer, this.waitingForServe, () => this.serveBall());
        });
    }


    updateBall() {
        this.ball.x += this.ball.velocityX;
        this.ball.y += this.ball.velocityY;

        if (this.ball.y <= this.ballSize/2 || this.ball.y >= this.gameHeight - this.ballSize/2) {
            this.ball.velocityY = -this.ball.velocityY;
        }

        if (this.ball.x <= 0) {
            this.score.player2++;
            this.servingPlayer = 2;
            this.updateScore();
            this.resetBall();
            this.resetAI();
        }

        if (this.ball.x >= this.gameWidth) {
            this.score.player1++;
            this.servingPlayer = 1;
            this.updateScore();
            this.resetBall();
            this.resetAI();
        }
    }

    checkCollisions() {
        this.players.forEach(player => {
            player.checkCollision(this.ball, this.ballSize);
        });
    }

    updateScore() {
        this.player1ScoreEl.textContent = this.score.player1;
        this.player2ScoreEl.textContent = this.score.player2;
    }

    drawMondrianComposition() {
        this.mondrianGrid.forEach(rect => {
            this.ctx.fillStyle = rect.color;
            this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = this.gridlineThickness;
            this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        });
        
        this.players.forEach(player => {
            player.render(this.ctx, this.gridlineThickness, this.gameHeight);
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
        
        this.drawMondrianComposition();

        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(this.ball.x - this.ballSize/2, this.ball.y - this.ballSize/2, this.ballSize, this.ballSize);
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Pongdriaan();
});