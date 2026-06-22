export const SNAKE_SIZE = 24

export type SnakeMode = 'classic' | 'wrap' | 'rush' | 'maze'
export type SnakeDifficulty = 'chill' | 'normal' | 'turbo'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Point = { x: number; y: number }
export type Food = Point & { kind: 'normal' | 'bonus' }

export type SnakeState = {
  snake: Point[]
  direction: Direction
  food: Food | null
  obstacles: Point[]
  score: number
  apples: number
  dead: boolean
  won: boolean
}

export type ModeDefinition = {
  label: string
  description: string
  rule: string
}

export type DifficultyDefinition = {
  label: string
  tickMs: number
  description: string
}

export const SNAKE_MODES: Record<SnakeMode, ModeDefinition> = {
  classic: {
    label: 'classic',
    description: 'the familiar wall-bound game',
    rule: 'Walls and your own tail are deadly.',
  },
  wrap: {
    label: 'wrap',
    description: 'edges connect to the other side',
    rule: 'Cross an edge and emerge opposite it.',
  },
  rush: {
    label: 'rush',
    description: 'score as much as possible in 60 seconds',
    rule: 'Speed rises quickly; every fifth fruit is worth 3.',
  },
  maze: {
    label: 'maze',
    description: 'navigate barriers that keep multiplying',
    rule: 'Starts with walls and adds a new block every 3 fruit.',
  },
}

export const SNAKE_MODE_ORDER: SnakeMode[] = ['classic', 'wrap', 'rush', 'maze']

export const SNAKE_DIFFICULTIES: Record<SnakeDifficulty, DifficultyDefinition> = {
  chill: { label: 'chill', tickMs: 150, description: 'room to think' },
  normal: { label: 'normal', tickMs: 105, description: 'arcade pace' },
  turbo: { label: 'turbo', tickMs: 72, description: 'tiny margin for regret' },
}

export const SNAKE_DIFFICULTY_ORDER: SnakeDifficulty[] = ['chill', 'normal', 'turbo']

const DELTAS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

export function isOpposite(a: Direction, b: Direction): boolean {
  return OPPOSITE[a] === b
}

export function mazeObstacles(): Point[] {
  const points: Point[] = []
  const addLine = (fixed: number, start: number, end: number, vertical: boolean, gap: number) => {
    for (let value = start; value <= end; value++) {
      if (value === gap) continue
      points.push(vertical ? { x: fixed, y: value } : { x: value, y: fixed })
    }
  }
  addLine(5, 3, 9, true, 7)
  addLine(18, 3, 9, true, 5)
  addLine(5, 15, 21, true, 18)
  addLine(18, 15, 21, true, 17)
  addLine(6, 8, 15, false, 11)
  addLine(17, 8, 15, false, 13)
  return points
}

function randomFreePoint(snake: Point[], obstacles: Point[]): Point | null {
  const occupied = new Set([
    ...snake.map((point) => `${point.x},${point.y}`),
    ...obstacles.map((point) => `${point.x},${point.y}`),
  ])
  const free: Point[] = []
  for (let y = 0; y < SNAKE_SIZE; y++) {
    for (let x = 0; x < SNAKE_SIZE; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y })
    }
  }
  return free.length > 0 ? free[Math.floor(Math.random() * free.length)] : null
}

function spawnFood(
  snake: Point[],
  obstacles: Point[],
  mode: SnakeMode,
  nextAppleNumber: number,
): Food | null {
  const point = randomFreePoint(snake, obstacles)
  if (!point) return null
  return {
    ...point,
    kind: mode === 'rush' && nextAppleNumber % 5 === 0 ? 'bonus' : 'normal',
  }
}

export function createSnakeGame(mode: SnakeMode): SnakeState {
  const snake = [
    { x: 12, y: 12 },
    { x: 11, y: 12 },
    { x: 10, y: 12 },
    { x: 9, y: 12 },
  ]
  const obstacles = mode === 'maze' ? mazeObstacles() : []
  return {
    snake,
    direction: 'right',
    food: spawnFood(snake, obstacles, mode, 1),
    obstacles,
    score: 0,
    apples: 0,
    dead: false,
    won: false,
  }
}

function addMazeObstacle(snake: Point[], obstacles: Point[], food: Food | null): Point[] {
  const candidates: Point[] = []
  for (let y = 2; y < SNAKE_SIZE - 2; y++) {
    for (let x = 2; x < SNAKE_SIZE - 2; x++) {
      const point = { x, y }
      if (snake.some((part) => samePoint(part, point))) continue
      if (obstacles.some((block) => samePoint(block, point))) continue
      if (food && samePoint(food, point)) continue
      if (Math.abs(x - snake[0].x) + Math.abs(y - snake[0].y) < 4) continue
      candidates.push(point)
    }
  }
  if (candidates.length === 0) return obstacles
  return [...obstacles, candidates[Math.floor(Math.random() * candidates.length)]]
}

export function stepSnake(
  state: SnakeState,
  requestedDirection: Direction,
  mode: SnakeMode,
): SnakeState {
  if (state.dead || state.won || !state.food) return state

  const direction = isOpposite(state.direction, requestedDirection)
    ? state.direction
    : requestedDirection
  const delta = DELTAS[direction]
  let head = {
    x: state.snake[0].x + delta.x,
    y: state.snake[0].y + delta.y,
  }

  if (mode === 'wrap') {
    head = {
      x: (head.x + SNAKE_SIZE) % SNAKE_SIZE,
      y: (head.y + SNAKE_SIZE) % SNAKE_SIZE,
    }
  } else if (
    head.x < 0 ||
    head.x >= SNAKE_SIZE ||
    head.y < 0 ||
    head.y >= SNAKE_SIZE
  ) {
    return { ...state, direction, dead: true }
  }

  const eating = samePoint(head, state.food)
  const collisionBody = eating ? state.snake : state.snake.slice(0, -1)
  if (
    collisionBody.some((part) => samePoint(part, head)) ||
    state.obstacles.some((block) => samePoint(block, head))
  ) {
    return { ...state, direction, dead: true }
  }

  const snake = [head, ...state.snake]
  if (!eating) snake.pop()
  if (!eating) return { ...state, snake, direction }

  const apples = state.apples + 1
  const score = state.score + (state.food.kind === 'bonus' ? 3 : 1)
  const obstacles =
    mode === 'maze' && apples % 3 === 0
      ? addMazeObstacle(snake, state.obstacles, state.food)
      : state.obstacles
  const food = spawnFood(snake, obstacles, mode, apples + 1)
  return {
    ...state,
    snake,
    direction,
    obstacles,
    food,
    apples,
    score,
    won: food == null,
  }
}

export function tickDelay(
  difficulty: SnakeDifficulty,
  mode: SnakeMode,
  apples: number,
): number {
  const base = SNAKE_DIFFICULTIES[difficulty].tickMs
  const ramp = mode === 'rush' ? apples * 3.4 : mode === 'classic' ? apples * 1.2 : apples * 0.7
  return Math.max(mode === 'rush' ? 42 : 52, Math.round(base - ramp))
}

