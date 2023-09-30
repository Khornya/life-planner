import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'

const RootLayout = (props: any) => {
  const { children } = props
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
export default RootLayout
