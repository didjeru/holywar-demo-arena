const fs = require('fs');
const vm = require('vm');

class Arena {
  constructor(bot) {
    this.mapSize = 9;
    this.users = [];
    this.nextPosition = { x: -1, y: -1 };

    try {
      const filePath = `${__dirname}/${bot}`;
      this.source = fs.readFileSync(filePath);
    } catch (err) {
      console.error('Usage: node arena.js index.js');
      process.exit(1);
    }

    this.users.push(
      this.addBot('RANDOM-1'),
      this.addBot('RANDOM-2'),
      this.addBot('RANDOM-3'),
      this.addBot('KILLER'),
    );
  }

  run() {
    const match = {
      players: this.users.map(({ name, x, y }) => ({
        username: name,
        initialPosition: { x, y },
      })),
      mapSize: this.mapSize,
      gameLog: [],
      score: {},
    };

    for (let round = 1; round <= 50; round++) {
      const currentUsers = this.users.filter(user => user.isAlive);

      if (currentUsers.length === 1) {
        break;
      }

      const moves = [];

      currentUsers.forEach(user => {
        if (user.isAlive) {
          let moveType = 'IDLE';
          let playersKilled;
          let newPosition;
          const context = vm.createContext({ API: this.getApi(user) });
          vm.runInContext(user.code, context);
          const { x, y } = this.nextPosition;
          const distance = this.getDistance({ x: user.x, y: user.y }, { x, y });
          if (user.name === 'KILLER')
            console.log(
              user.x,
              user.y,
              '->',
              x,
              y,
              '=',
              distance,
              this.isValidPosition(x, y),
            );

          if (this.isValidPosition(x, y) && distance <= user.actionPoints) {
            const enemy = this.getUserByPosition(x, y);

            user.x = x;
            user.y = y;

            if (enemy && enemy.name !== user.name) {
              moveType = 'KILL';
              playersKilled = enemy.name;
              enemy.isAlive = false;
              user.score += 10;
            } else {
              moveType = 'MOVE';
              user.actionPoints -= distance;
              user.score += 1;
            }

            newPosition = { row: x, col: y };
          } else {
            user.actionPoints -= 2;
          }

          user.actionPoints += 1;

          if (user.actionPoints >= 3) {
            user.actionPoints = 3;
          } else if (user.actionPoints <= 1) {
            user.actionPoints = 1;
          }

          moves.push({
            moveType,
            playersKilled,
            playerId: user.name,
            newPosition,
            actionPointsLeft: user.actionPoints,
          });
        }
      });

      match.gameLog.push({
        roundNumber: round,
        moves,
      });
    }

    match.score = this.getResults();

    return match;
  }

  addBot(name) {
    let position = this.getFreePosition();

    return {
      name,
      isAlive: true,
      x: position.x,
      y: position.y,
      score: 0,
      actionPoints: 3,
      code:
        name === 'KILLER'
          ? this.source
          : `
        function rand() {
          return Math.round(Math.random());
        }

        let { x, y } = API.getCurrentPosition();

        if (rand()) {
          x = rand() ? x + 1 : x - 1;
          if (x <= 0) {
            x += 1;
          } else if (x >= API.getArenaSize() - 1) {
            x -= 1;
          }
        } else {
          y = rand() ? y + 1 : y - 1;
          if (y <= 0) {
            y += 1;
          } else if (y >= API.getArenaSize() - 1) {
            y -= 1;
          }
        }

        API.move(x, y);
      `,
    };
  }

  isBusyPosition() {
    return this.users.some(
      user => user.x === position.x && user.y === position.y,
    );
  }

  getUserByPosition(x, y) {
    return this.users.find(
      user => user.isAlive && user.x === x && user.y === y,
    );
  }

  getRandomPosition() {
    return {
      x: this.getRandomInt(this.mapSize),
      y: this.getRandomInt(this.mapSize),
    };
  }

  getFreePosition() {
    let position = this.getRandomPosition();

    while (this.isBusyPosition(position)) {
      position = this.getRandomPosition();
    }

    return position;
  }

  getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }

  getResults() {
    return this.users.reduce(
      (acc, user) => ({ ...acc, [user.name]: user.score }),
      {},
    );
  }

  getApi(bot) {
    return {
      getActionPointsCount: () => bot.actionPoints,
      getArenaSize: () => this.mapSize,
      getCurrentPosition: () => ({ x: bot.x, y: bot.y }),
      getEnemies: () =>
        this.users
          .filter(user => user.name !== bot.name && user.isAlive)
          .map(({ x, y }) => ({
            position: { x, y },
          })),
      move: (x, y) => {
        this.nextPosition = { x, y };
      },
    };
  }

  getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  isValidPosition(x, y) {
    return x >= 0 && x < this.mapSize && y >= 0 && y < this.mapSize;
  }
}

const arena = new Arena(process.argv[2]);
const result = arena.run();

fs.writeFileSync('./log.json', JSON.stringify(result, null, 2));

console.dir(result, { depth: 3 });
