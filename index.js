function rand() {
  return Math.round(Math.random());
}

let { x, y } = API.getCurrentPosition();

if (rand()) {
  x = rand() ? x + 1 : x - 1;
} else {
  y = rand() ? y + 1 : y - 1;
}

API.move(x, y);
