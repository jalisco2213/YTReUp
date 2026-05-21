import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import Download from '@/views/Download.vue'
import Upload from '@/views/Upload.vue'
import Videos from '@/views/Videos.vue'
import Settings from '@/views/Settings.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: Dashboard },
    { path: '/download', component: Download },
    { path: '/queue', redirect: '/download' },
    { path: '/upload', component: Upload },
    { path: '/videos', component: Videos },
    { path: '/settings', component: Settings }
  ]
})