window.onload = setup

const None = Object.freeze({keyCode: 'Space', name: 'None', move: moveFunction(0, 0)})
const Up = Object.freeze({keyCode: 'ArrowUp', name: 'Up', move: moveFunction(0, -1)})
const Down = Object.freeze({keyCode: 'ArrowDown', name: 'Down', move: moveFunction(0, 1)})
const Left = Object.freeze({keyCode: 'ArrowLeft', name: 'Left', move: moveFunction(-1, 0)})
const Right = Object.freeze({keyCode: 'ArrowRight', name: 'Right', move: moveFunction(1, 0)})
const Directions = Object.freeze([None, Up, Down, Left, Right])

function setup() {
    const gridSize = 20
    const snakeBoard = document.getElementById('snake-board')
    const gc = snakeBoard.getContext('2d')
    const boardWidth = 40
    const boardHeight = 40

    let currentPosition
    let currentDirection
    let directionQueue
    let lastDirection
    let state
    let snakeFields
    let snakeLength
    let failed

    setInitialState()

    function setInitialState() {
        currentPosition = {x: 0, y: 0}
        currentDirection = None
        directionQueue = []
        state = BoardState()
        snakeFields = []
        snakeLength = 20
        failed = false
    }

    window.onkeydown = event => {
        if (event.code === 'Escape') {
            setInitialState()
            gc.reset()
            gc.clearRect(0, 0, snakeBoard.width, snakeBoard.height)
            processCurrentPosition()
            return
        }
        for (let direction of Directions) {
            if (event.code === direction.keyCode) {
                directionQueue.push(direction)
            }
        }
    }

    processCurrentPosition()

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
        let [newX, newY] = currentDirection.move(currentPosition.x, currentPosition.y)
        if (newX === currentPosition.x && newY === currentPosition.y) {
            return
        }
        if (!insideBoard(newX, newY) || hitSnake(newX, newY)) {
            failed = true
            gc.fillStyle = '#ff003366'
            gc.fillRect(0, 0, snakeBoard.width, snakeBoard.height)
        } else {
            [currentPosition.x, currentPosition.y] = [newX, newY]
            processCurrentPosition()
        }
    }

    function hitSnake(newX, newY) {
        let hit = state.get(newX, newY)
        return hit && !atLastFieldOfSnake(newX, newY)
    }

    function atLastFieldOfSnake(x, y) {
        let lastField = snakeFields[0]
        return x === lastField.x && y === lastField.y
    }

    function processCurrentPosition() {
        state.set(currentPosition.x, currentPosition.y, true)
        snakeFields.push({x: currentPosition.x, y: currentPosition.y})
        if (snakeFields.length > snakeLength) {
            let lastField = snakeFields.shift()
            state.set(lastField.x, lastField.y, false)
            remove(lastField.x, lastField.y)
        }
        draw()
    }

    function draw() {
        gc.fillStyle = 'black'
        gc.fillRect(currentPosition.x * gridSize, currentPosition.y * gridSize, gridSize, gridSize)
    }

    function remove(x, y) {
        gc.clearRect(x * gridSize, y * gridSize, gridSize, gridSize)
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

    function BoardState() {
        const data = new Array(boardWidth * boardHeight)
        data.fill(false)
        return {
            set(x, y, value) {
                if (insideBoard(x, y)) {
                    data[address(x, y)] = value
                }
            },
            get(x, y) {
                if (insideBoard(x, y)) {
                    return data[address(x, y)] === true
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