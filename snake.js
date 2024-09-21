window.onload = setup

const None = Object.freeze({keyCode: 'Space', name: 'None', move: moveFunction(0, 0)})
const Up = Object.freeze({keyCode: 'ArrowUp', name: 'Up', move: moveFunction(0, -1)})
const Down = Object.freeze({keyCode: 'ArrowDown', name: 'Down', move: moveFunction(0, 1)})
const Left = Object.freeze({keyCode: 'ArrowLeft', name: 'Left', move: moveFunction(-1, 0)})
const Right = Object.freeze({keyCode: 'ArrowRight', name: 'Right', move: moveFunction(1, 0)})
const Directions = Object.freeze([None, Up, Down, Left, Right])

function setup() {
    const gridSize = 20;
    const snakeBoard = document.getElementById('snake-board')
    const gc = snakeBoard.getContext('2d')
    const boardWidth = 40
    const boardHeight = 40

    let x
    let y
    let currentDirection
    let directionQueue
    let lastDirection
    let failed
    let snakeFields

    setInitialState()

    function setInitialState() {
        x = 0
        y = 0
        currentDirection = None
        directionQueue = []
        snakeFields = SnakeFields()
        failed = false
    }

    window.onkeydown = event => {
        if (event.code === 'Escape') {
            setInitialState()
            gc.reset()
            gc.clearRect(0, 0, snakeBoard.width, snakeBoard.height)
            draw()
            return
        }
        for (let direction of Directions) {
            if (event.code === direction.keyCode) {
                directionQueue.push(direction)
            }
        }
    }

    draw()

    const interval = setInterval(move, 100)

    function move() {
        if (failed) {
            return
        }
        while (directionQueue.length > 0) {
            let newDirection = directionQueue.shift()
            if (directionApplicable(newDirection)) {
                currentDirection = newDirection
                break
            }
        }
        let [newX, newY] = currentDirection.move(x, y);
        if (newX === x && newY === y) {
            return
        }
        if (!insideBoard(newX, newY) || snakeFields.get(newX, newY)) {
            failed = true
            gc.fillStyle = '#ff003366'
            gc.fillRect(0, 0, snakeBoard.width, snakeBoard.height)
        } else {
            [x, y] = [newX, newY]
            snakeFields.set(x, y)
            draw();
        }
    }

    function draw() {
        gc.fillStyle = 'black'
        gc.fillRect(x * gridSize, y * gridSize, gridSize, gridSize)
    }

    function directionApplicable(direction) {
        if (direction === None && currentDirection !== None) {
            lastDirection = currentDirection
            return true
        }

        switch (currentDirection) {
            case None:
                return direction !== opposite(lastDirection)
            case Up:
            case Down:
                return direction === Left || direction === Right
            case Left:
            case Right:
                return direction === Up || direction === Down
        }
    }

    function SnakeFields() {
        const state = new Array(boardWidth * boardHeight)
        return {
            set(x, y) {
                if (insideBoard(x, y)) {
                    state[address(x, y)] = true
                }
            },
            get(x, y) {
                if (insideBoard(x, y)) {
                    return state[address(x, y)] === true
                }
            }
        }
        function address(x, y) {
            return y * boardWidth + x
        }
    }

    function insideBoard(x, y) {
        return 0 <= x && x < boardWidth
            && 0 <= y && y < boardHeight
    }
}

function opposite(direction) {
    switch (direction) {
        case Up: return Down
        case Down: return Up
        case Left: return Right
        case Right: return Left
    }
}

function moveFunction(dx, dy) {
    return (x, y) => [x + dx, y + dy]
}