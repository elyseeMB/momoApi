/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

const MomoApiCreatesController = () => import('#controllers/momo_api_creates_controller')
import router from '@adonisjs/core/services/router'

router.get('/', [MomoApiCreatesController, 'index']).as('api_create')
