import { AppBar, Container, Toolbar, Typography } from '@mui/material'

function App() {
  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="h1">
            Orders
          </Typography>
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ py: 3 }} />
    </>
  )
}

export default App
