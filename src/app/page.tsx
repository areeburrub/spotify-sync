import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/auth'

export default async function HomePage() {
  const user = await getAuthenticatedUser()
  
  if (user) {
    redirect('/app')
  } else {
    redirect('/login')
  }
}
