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

    let x
    let y
    let currentDirection
    let directionQueue
    let lastDirection

    setInitialState()

    function setInitialState() {
        x = 0
        y = 0
        currentDirection = None
        directionQueue = []
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
        while (directionQueue.length > 0) {
            let newDirection = directionQueue.shift()
            if (directionApplicable(newDirection)) {
                currentDirection = newDirection
                break
            }
        }
        [x, y] = currentDirection.move(x, y)
        draw();
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