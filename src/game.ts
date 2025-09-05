// Warning: this game was written by Claude Code, so it's probably rubbish.

interface KeyConfig {
  up: string;
  down: string;
  ai: string;
}

interface Paddle {
  y: number;
  height: number;
  width: number;
  speed: number;
  columnX: number;
  minY: number;
  maxY: number;
}

interface GameState {
  ball: Ball;
  paddle: Paddle;
  opponentPaddle: Paddle;
  currentTime: number;
}

interface AIMovement {
  direction: 'up' | 'down' | 'none';
  speed: number;
}

class AI {
  protected skillFrom0to1: number = 0.5;
  public competitiveness: number = 3;
  public laziness: number = 5;

  private playerId: 1 | 2;
  private reactionTime: number = 150;
  private mistakeProbability: number = 0.1;
  private lastDecisionTime: number = 0;
  private targetY: number = 0;
  private nextMistakeTime: number = 0;
  private lastBallVelocityX: number = 0;
  private wrongDirectionTime: number = 0;

  constructor(playerId: number) {
    this.playerId = playerId < 2 ? 1 : 2;
    this.reset();
  }

  getSkill(): number {
    return this.skillFrom0to1;
  }

  setSkill(skill: number): void {
    this.skillFrom0to1 = skill;

    // High skill: 50-100ms reaction, Low skill: 100-300ms reaction
    this.reactionTime = skill >= 1
      ? 50 + Math.random() * 50
      : 100 + (1 - skill) * 200;

    // High skill: very low mistake probability, Low skill: higher mistakes
    this.mistakeProbability = skill >= 1
      ? 0
      : 0.08 + (1 - skill) * 0.3;
  }

  private predictBallInterception(gameState: GameState): number {
    const { ball, paddle, opponentPaddle } = gameState;
    const paddleX = paddle.columnX + (this.playerId === 1 ? paddle.width : 0);

    // If ball is moving away from us, return current ball position
    const ballMovingTowardsUs = (this.playerId === 1 && ball.velocityX < 0) || (this.playerId === 2 && ball.velocityX > 0);
    if (!ballMovingTowardsUs) {
      return ball.y;
    }

    let predictionX = ball.x;
    let predictionY = ball.y;
    let velocityX = ball.velocityX;
    let velocityY = ball.velocityY;

    // Simulate ball movement until it reaches paddle's x-position
    const maxIterations = 1000; // Prevent infinite loops
    let iterations = 0;

    while (iterations < maxIterations) {
      // Check if we've reached the paddle's x-position
      if ((this.playerId === 1 && predictionX <= paddleX) || (this.playerId === 2 && predictionX >= paddleX)) {
        break;
      }

      // Move ball one step
      predictionX += velocityX;
      predictionY += velocityY;

      // Handle top/bottom wall bounces
      if (predictionY <= 6 || predictionY >= (gameState.paddle.maxY + gameState.paddle.height + 6)) {
        velocityY = -velocityY;
        predictionY = Math.max(6, Math.min(predictionY, gameState.paddle.maxY + gameState.paddle.height + 6));
      }

      iterations++;
    }

    return predictionY;
  }

  getMovement(gameState: GameState): AIMovement {
    const { ball, paddle, currentTime } = gameState;
    const paddleCenter = paddle.y + paddle.height / 2;

    // Detect ball direction change (bounce)
    const ballDirectionChanged = Math.sign(ball.velocityX) !== Math.sign(this.lastBallVelocityX) && this.lastBallVelocityX !== 0;

    if (currentTime - this.lastDecisionTime > this.reactionTime) {
      let shouldMakeMistake = false;
      let mistakeType = '';

      // Check if we should make a mistake
      if (currentTime > this.nextMistakeTime && this.skillFrom0to1 < 1) {
        shouldMakeMistake = Math.random() < this.mistakeProbability;
        this.nextMistakeTime = currentTime + Math.random() * 4000 + 2000;

        // Choose mistake type
        const mistakeRand = Math.random();
        if (mistakeRand < 0.33) {
          mistakeType = 'overshoot';
        } else if (mistakeRand < 0.66) {
          mistakeType = 'undershoot';
        } else {
          mistakeType = 'wrong_direction';
        }
      }

      // Handle wrong direction on ball bounce
      if (ballDirectionChanged && this.skillFrom0to1 < 1 && Math.random() < (1 - this.skillFrom0to1) * 0.4) {
        mistakeType = 'wrong_direction';
        shouldMakeMistake = true;
        this.wrongDirectionTime = currentTime + 200 + Math.random() * 300; // Wrong direction for 200-500ms
      }

      if (shouldMakeMistake) {
        switch (mistakeType) {
          case 'overshoot':
            // Overshoot by 30-100 pixels beyond ball position
            const overshoot = 30 + Math.random() * 70;
            this.targetY = ball.y + (ball.y > paddleCenter ? overshoot : -overshoot);
            break;

          case 'undershoot':
            // Undershoot by moving only partway to ball
            const undershootFactor = 0.3 + Math.random() * 0.4; // 30-70% of the way
            this.targetY = paddleCenter + (ball.y - paddleCenter) * undershootFactor;
            break;

          case 'wrong_direction':
            // Move in opposite direction temporarily
            this.targetY = paddleCenter + (ball.y - paddleCenter) * -1;
            break;
        }
      } else {
        // Scale between current position (skill 0) and predicted position (skill 1)
        const currentBallY = ball.y;
        const predictedBallY = this.predictBallInterception(gameState);

        // Interpolate between current and predicted position based on skill
        const targetBallY = currentBallY + (predictedBallY - currentBallY) * this.skillFrom0to1;

        if (this.skillFrom0to1 === 1) {
          this.targetY = targetBallY; // Perfect prediction
        } else {
          // Add slight tracking error based on skill
          const trackingError = (1 - this.skillFrom0to1) * 20 * (Math.random() - 0.5);
          this.targetY = targetBallY + trackingError;
        }
      }

      this.lastDecisionTime = currentTime;
    }

    // If we're in wrong direction mode, check if we should recover
    if (currentTime > this.wrongDirectionTime && this.wrongDirectionTime > 0) {
      this.wrongDirectionTime = 0;
      // Correct back to proper tracking with prediction
      const currentBallY = ball.y;
      const predictedBallY = this.predictBallInterception(gameState);
      const targetBallY = currentBallY + (predictedBallY - currentBallY) * this.skillFrom0to1;

      if (this.skillFrom0to1 === 1) {
        this.targetY = targetBallY;
      } else {
        const trackingError = (1 - this.skillFrom0to1) * 20 * (Math.random() - 0.5);
        this.targetY = targetBallY + trackingError;
      }
    }

    // Determine movement direction
    const targetCenter = this.targetY;
    const diff = targetCenter - paddleCenter;
    const threshold = 10;

    this.lastBallVelocityX = ball.velocityX;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        return { direction: 'down', speed: paddle.speed };
      } else {
        return { direction: 'up', speed: paddle.speed };
      }
    }

    return { direction: 'none', speed: 0 };
  }

  reset(): void {
    this.lastDecisionTime = Date.now();
    this.targetY = 0;
    this.nextMistakeTime = Date.now() + Math.random() * 3000 + 2000;
    this.lastBallVelocityX = 0;
    this.wrongDirectionTime = 0;
  }
}

interface Ball {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  speed: number;
}

interface PaddleConfig {
  width: number;
  height: number;
  speed: number;
  buffer: number;
}

interface Score {
  player1: number;
  player2: number;
}

interface MondrianRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface GameKeyConfig {
  player1Up: string;
  player1Down: string;
  player1AI: string;
  player2Up: string;
  player2Down: string;
  player2AI: string;
}

type GameState = 'playing' | 'serving';

class Player {
  public readonly playerId: number;
  public isAI: boolean;
  public readonly serveDirection: number;
  public readonly keyConfig: KeyConfig;
  public readonly paddle: Paddle;
  public readonly ai: AI;

  constructor(
    playerId: number,
    keyConfig: KeyConfig,
    columnX: number,
    gameHeight: number,
    paddleConfig: PaddleConfig
  ) {
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

    this.ai = new AI(playerId);
    this.ai.setSkill(0.5);
  }

  public setSkill(skill_from_0_to_1: number): void {
    this.ai.setSkill(skill_from_0_to_1);
  }

  public handleInput(
    keys: Record<string, boolean>,
    servingPlayer: number,
    waitingForServe: boolean,
    onServe: () => void
  ): void {
    // Handle AI control toggle
    if (keys[this.keyConfig.ai]) {
      this.isAI = true;
    }

    // Handle up movement
    else if (keys[this.keyConfig.up]) {
      this.isAI = false;
      if (this.paddle.y > this.paddle.minY) this.paddle.y -= this.paddle.speed;
    }

    // Handle down movement  
    else if (keys[this.keyConfig.down]) {
      this.isAI = false;
      if (this.paddle.y < this.paddle.maxY) this.paddle.y += this.paddle.speed;

      if (waitingForServe && servingPlayer !== this.playerId) onServe();
    }
    else
      return;

    if (waitingForServe && servingPlayer !== this.playerId) onServe();
  }

  public updateAI(
    ball: Ball,
    currentTime: number,
    servingPlayer: number,
    waitingForServe: boolean,
    onServe: () => void,
    opponentPaddle: Paddle
  ): void {
    if (!this.isAI) return;

    if (waitingForServe && servingPlayer !== this.playerId) {
      onServe();
    }

    const gameState: GameState = {
      ball,
      paddle: this.paddle,
      opponentPaddle,
      currentTime
    };

    const movement = this.ai.getMovement(gameState);

    switch (movement.direction) {
      case 'up':
        if (this.paddle.y > this.paddle.minY) {
          this.paddle.y -= movement.speed;
        }
        break;
      case 'down':
        if (this.paddle.y < this.paddle.maxY) {
          this.paddle.y += movement.speed;
        }
        break;
      case 'none':
        // No movement
        break;
    }
  }

  public update(
    keys: Record<string, boolean>,
    ball: Ball,
    currentTime: number,
    servingPlayer: number,
    waitingForServe: boolean,
    onServe: () => void,
    opponentPaddle: Paddle
  ): void {
    this.handleInput(keys, servingPlayer, waitingForServe, onServe);
    this.updateAI(ball, currentTime, servingPlayer, waitingForServe, onServe, opponentPaddle);
  }

  public render(ctx: CanvasRenderingContext2D, gridlineThickness: number, gameHeight: number): void {
    const lineOffset = gridlineThickness / 2;
    const paddleWidth = this.paddle.width;
    const paddleHeight = this.paddle.height;

    // Draw white blocks above and below paddle
    ctx.fillStyle = '#ffffff';

    if (this.paddle.y > 0) {
      ctx.fillRect(
        this.paddle.columnX + lineOffset,
        lineOffset,
        paddleWidth - gridlineThickness,
        this.paddle.y - lineOffset
      );
    }

    if (this.paddle.y + this.paddle.height < gameHeight) {
      ctx.fillRect(
        this.paddle.columnX + lineOffset,
        this.paddle.y + this.paddle.height,
        paddleWidth - gridlineThickness,
        gameHeight - this.paddle.y - paddleHeight - lineOffset
      );
    }

    // Draw blue paddle
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(this.paddle.columnX, this.paddle.y, paddleWidth, paddleHeight);

    // Draw paddle column gridlines
    ctx.strokeStyle = '#000';
    ctx.lineWidth = gridlineThickness;
    ctx.strokeRect(this.paddle.columnX, 0, paddleWidth, gameHeight - lineOffset);

    // Draw segment borders
    if (this.paddle.y > 0) {
      ctx.strokeRect(this.paddle.columnX, 0, paddleWidth, this.paddle.y);
    }

    ctx.strokeRect(this.paddle.columnX, this.paddle.y, paddleWidth, paddleHeight);

    if (this.paddle.y + paddleHeight < gameHeight) {
      ctx.strokeRect(this.paddle.columnX, this.paddle.y + paddleHeight,
        paddleWidth, gameHeight - this.paddle.y - paddleHeight);
    }
  }

  public checkCollision(ball: Ball, ballSize: number): boolean {
    const movingTowardsPaddle = this.playerId === 1 ? ball.velocityX < 0 : ball.velocityX > 0;

    if (movingTowardsPaddle &&
      ((this.playerId === 1 && ball.x - ballSize / 2 <= this.paddle.columnX + this.paddle.width) ||
        (this.playerId === 2 && ball.x + ballSize / 2 >= this.paddle.columnX)) &&
      ball.x + ballSize / 2 >= this.paddle.columnX &&
      ball.x - ballSize / 2 <= this.paddle.columnX + this.paddle.width &&
      ball.y >= this.paddle.y &&
      ball.y <= this.paddle.y + this.paddle.height) {

      ball.velocityX = -ball.velocityX;
      ball.velocityY += (ball.y - (this.paddle.y + this.paddle.height / 2)) * 0.1;
      return true;
    }
    return false;
  }

  public resetAI(): void {
    this.ai.reset();
  }

  public getServePosition(serveOffset: number): { x: number; y: number } {
    const ballX = this.playerId === 1
      ? this.paddle.columnX + this.paddle.width + serveOffset
      : this.paddle.columnX - serveOffset;
    const ballY = this.paddle.y + this.paddle.height / 2;

    return { x: ballX, y: ballY };
  }
}

class Pongdriaan {
  private readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly score1_el: HTMLElement;
  private readonly score2_el: HTMLElement;
  private readonly difficulty1_el: HTMLElement;
  private readonly difficulty2_el: HTMLElement;
  private readonly instructions_el: HTMLElement;

  private readonly canvasWidth: number;
  private readonly canvasHeight: number;
  private readonly gameWidth: number;
  private readonly gameHeight: number;

  private readonly keyConfig: GameKeyConfig;
  private gameState: GameState;
  private readonly keys: Record<string, boolean>;

  private servingPlayer: number;
  private waitingForServe: boolean;
  private readonly serveOffset: number;

  private readonly gridlineThickness: number;
  private readonly ballSize: number;

  private readonly ball: Ball;
  private readonly players: Player[];
  private readonly score: Score;
  private readonly mondrianGrid: MondrianRect[];

  constructor(document) {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.g = this.canvas.getContext('2d');
    this.score1_el = document.getElementById('score-player1');
    this.score2_el = document.getElementById('score-player2');
    this.difficulty1_el = document.getElementById('difficulty-player1');
    this.difficulty2_el = document.getElementById('difficulty-player2');
    this.instructions_el = document.getElementById('instructions');

    this.canvasWidth = this.canvas.width;
    this.canvasHeight = this.canvas.height;

    this.keyConfig = {
      player1Up: 'Q',
      player1Down: 'A',
      player1AI: 'Z',
      player2Up: 'O',
      player2Down: 'K',
      player2AI: 'M'
    };

    this.gameState = 'playing';
    this.keys = {};

    this.servingPlayer = 1;
    this.waitingForServe = false;
    this.serveOffset = 20;

    this.gridlineThickness = 6;
    this.ballSize = 2 * this.gridlineThickness;

    this.gameWidth = this.canvasWidth - this.gridlineThickness;
    this.gameHeight = this.canvasHeight - this.gridlineThickness;

    this.ball = {
      x: this.gameWidth / 2,
      y: this.gameHeight / 2,
      velocityX: 5,
      velocityY: 3,
      speed: 5
    };

    const paddleConfig: PaddleConfig = {
      width: this.ballSize + this.gridlineThickness * 2,
      height: this.ballSize * 8,
      speed: 8,
      buffer: this.ballSize * 2
    };

    this.players = [
      new Player(1, {
        up: this.keyConfig.player1Up,
        down: this.keyConfig.player1Down,
        ai: this.keyConfig.player1AI
      },
        60,
        this.gameHeight,
        paddleConfig),

      new Player(2, {
        up: this.keyConfig.player2Up,
        down: this.keyConfig.player2Down,
        ai: this.keyConfig.player2AI
      },
        this.gameWidth - 70,
        this.gameHeight,
        paddleConfig)
    ];

    this.score = {
      player1: 0,
      player2: 0
    };

    this.instructions_el.textContent = `
        Press ${this.keyConfig.player1Up}/${this.keyConfig.player1Down}, or 
        ${this.keyConfig.player2Up}/${this.keyConfig.player2Down} to control a paddle; and ${this.keyConfig.player1AI} or ${this.keyConfig.player2AI} to hand control back to the AI.
        `;

    this.mondrianGrid = this.generateMondrianGrid(
      this.gameWidth,
      this.gameHeight
    );

    this.setupEventListeners(document);
    this.resetBall();
    this.resetAI();
    this.updateSkillDisplay();
    this.gameLoop();
  }

  private generateMondrianGrid(width: number, height: number): MondrianRect[] {
    const grid: MondrianRect[] = [];
    const colors = ['#ffffff', '#dc2626', '#fbbf24'];
    const colorWeights = [0.7, 0.15, 0.15];

    const generateRandomDivisions = (total: number, count: number): number[] => {
      const divisions = [0];
      const segments: number[] = [];

      for (let i = 1; i < count; i++) {
        const isWide = Math.random() < 0.25;
        const minSize = isWide ? Math.ceil(total * 0.25) : Math.max(this.ballSize * 2, Math.ceil(total * 0.03));
        const maxSize = isWide ? Math.floor(total * 0.5) : Math.max(this.ballSize * 2, Math.floor(total * 0.08));
        segments.push(minSize + (0.5 + Math.random()) * (maxSize - minSize));
      }

      const totalSegments = segments.reduce((a, b) => a + b, 0);
      const scale = (total - divisions[0]!) / totalSegments;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]!;
        const lastDivision = divisions[divisions.length - 1]!;
        divisions.push(Math.floor(lastDivision + segment * scale));
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

        const x = verticalDivisions[i]!;
        const y = horizontalDivisions[j]!;
        const rectWidth = verticalDivisions[i + 1]! - x;
        const rectHeight = horizontalDivisions[j + 1]! - y;

        if (rectWidth > 0 && rectHeight > 0) {
          const isPaddleColumn =
            this.players.some(player => x === player.paddle.columnX && rectWidth === player.paddle.width);

          if (isPaddleColumn) continue;

          const random = Math.random();
          let color = colors[0]!;
          let cumulWeight = 0;

          for (let k = 0; k < colors.length; k++) {
            cumulWeight += colorWeights[k]!;
            if (random <= cumulWeight) {
              color = colors[k]!;
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

  private setupEventListeners(document: HTMLDocument): void {
    document.addEventListener('keydown', (e) => {
      this.keys[e.key.toUpperCase()] = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toUpperCase()] = false;
    });
  }

  private resetBall(): void {
    this.waitingForServe = true;
    this.gameState = 'serving';

    const servingPlayer = this.players[this.servingPlayer - 1]!;
    const servePos = servingPlayer.getServePosition(this.serveOffset);

    this.ball.x = servePos.x;
    this.ball.y = servePos.y;
    this.ball.velocityX = this.ball.speed * servingPlayer.serveDirection;
    this.ball.velocityY = 0;
  }

  private serveBall(): void {
    this.waitingForServe = false;
    this.gameState = 'playing';

    // Randomize serve direction between ±30 degrees
    const servingPlayer = this.players[this.servingPlayer - 1]!;
    const angleRange = 30; // degrees
    const randomAngle = (Math.random() - 0.5) * 2 * angleRange; // -30 to +30 degrees
    const angleRadians = (randomAngle * Math.PI) / 180;

    // Calculate velocity components
    const baseVelocityX = this.ball.speed * servingPlayer.serveDirection;
    this.ball.velocityX = baseVelocityX * Math.cos(angleRadians);
    this.ball.velocityY = baseVelocityX * Math.sin(angleRadians);
  }

  private resetAI(): void {
    this.players.forEach(player => player.resetAI());
  }

  private update(): void {
    this.updatePaddles();

    if (this.gameState !== 'playing') return;

    this.updateBall();
    this.checkCollisions();
  }

  private updateAISkill(): void {
    this.players.forEach((player: Player) => {
      if (player.isAI) {
        const myScore = player.playerId === 1 ? this.score.player1 : this.score.player2;
        const opponentScore = player.playerId === 1 ? this.score.player2 : this.score.player1;
        const scoreDifference = opponentScore - myScore;
              
        const skill = Math.min(Math.max((scoreDifference + player.ai.laziness) / (player.ai.competitiveness + player.ai.laziness), 0), 1);

        player.setSkill(skill);
      }
    });
  }

  private updatePaddles(): void {
    const currentTime = Date.now();

    // Update skill based on score disparity for AI players
    this.updateAISkill();

    this.players.forEach((player, index) => {
      const opponentPaddle = this.players[1 - index]!.paddle;
      player.update(this.keys, this.ball, currentTime, this.servingPlayer, this.waitingForServe, () => this.serveBall(), opponentPaddle);
    });

    // Update skill display after potential AI status changes
    this.updateSkillDisplay();
  }

  private updateBall(): void {
    this.ball.x += this.ball.velocityX;
    this.ball.y += this.ball.velocityY;

    if (this.ball.y <= this.ballSize / 2 || this.ball.y >= this.gameHeight - this.ballSize / 2) {
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

  private checkCollisions(): void {
    this.players.forEach(player => {
      player.checkCollision(this.ball, this.ballSize);
    });
  }

  private updateScore(): void {
    this.score1_el.textContent = this.score.player1.toString();
    this.score2_el.textContent = this.score.player2.toString();
    this.updateSkillDisplay();
  }

  private updateSkillDisplay(): void {
    const player1 = this.players[0]!;
    const player2 = this.players[1]!;

    this.difficulty1_el.textContent = player1.isAI
      ? `AI: ${player1.ai.getSkill().toFixed(2)}`
      : 'Human';
    this.difficulty2_el.textContent = player2.isAI
      ? `AI: ${player2.ai.getSkill().toFixed(2)}`
      : 'Human';
  }

  private drawMondrianComposition(): void {
    this.g.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.g.save();
    this.g.translate(this.gridlineThickness, this.gridlineThickness);

    this.mondrianGrid.forEach(rect => {
      this.g.fillStyle = rect.color;
      this.g.fillRect(rect.x, rect.y, rect.width, rect.height);

      this.g.strokeStyle = '#000';
      this.g.lineWidth = this.gridlineThickness;
      this.g.strokeRect(rect.x, rect.y, rect.width, rect.height);
    });

    this.players.forEach(player => {
      player.render(this.g, this.gridlineThickness, this.gameHeight);
    });

    this.g.restore();
  }

  private draw(): void {
    this.g.clearRect(0, 0, this.gameWidth, this.gameHeight);

    this.drawMondrianComposition();

    this.g.fillStyle = '#000';
    this.g.fillRect(this.ball.x - this.ballSize / 2, this.ball.y - this.ballSize / 2, this.ballSize, this.ballSize);
  }

  private gameLoop(): void {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.gameLoop());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Pongdriaan(document);
});