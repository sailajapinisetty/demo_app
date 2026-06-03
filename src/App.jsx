import { useMemo, useState } from 'react'
import {
  HashRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { PRODUCTS } from './products'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function App() {
  const [cart, setCart] = useState({})
  const [toast, setToast] = useState('')

  const productsById = useMemo(
    () => Object.fromEntries(PRODUCTS.map((product) => [product.id, product])),
    [],
  )

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => ({
          product: productsById[id],
          quantity,
        }))
        .filter((item) => item.product),
    [cart, productsById],
  )

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)
  const subtotal = cartItems.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  )

  const flashToast = (message) => {
    setToast(message)
    window.clearTimeout(window.__toastTimer)
    window.__toastTimer = window.setTimeout(() => setToast(''), 1800)
  }

  const addToCart = (productId) => {
    setCart((previous) => ({
      ...previous,
      [productId]: (previous[productId] ?? 0) + 1,
    }))

    const product = productsById[productId]
    if (product) {
      flashToast(`${product.name} added to cart`)
    }
  }

  const removeFromCart = (productId) => {
    setCart((previous) => {
      const next = { ...previous }
      delete next[productId]
      return next
    })
  }

  const updateQuantity = (productId, quantity) => {
    const nextQuantity = Math.max(1, Number(quantity) || 1)
    setCart((previous) => ({
      ...previous,
      [productId]: nextQuantity,
    }))
  }

  return (
    <HashRouter>
      <div className="app-shell">
        <header className="site-header">
          <Link to="/" className="brand" data-testid="brand-link">
            Market place
          </Link>
          <nav className="main-nav">
            <Link to="/" data-testid="nav-home">
              Home
            </Link>
            <Link to="/cart" data-testid="nav-cart">
              Cart
              <span className="badge" data-testid="cart-badge">
                {cartCount}
              </span>
            </Link>
          </nav>
        </header>

        {toast ? (
          <aside className="toast" data-testid="success-toast">
            {toast}
          </aside>
        ) : null}

        <main>
          <Routes>
            <Route
              path="/"
              element={<HomePage addToCart={addToCart} cartCount={cartCount} />}
            />
            <Route
              path="/product/:productId"
              element={<ProductPage addToCart={addToCart} />}
            />
            <Route
              path="/cart"
              element={
                <CartPage
                  cartItems={cartItems}
                  subtotal={subtotal}
                  removeFromCart={removeFromCart}
                  updateQuantity={updateQuantity}
                />
              }
            />
            <Route
              path="/checkout"
              element={
                <CheckoutPage
                  cartItems={cartItems}
                  subtotal={subtotal}
                  onCheckoutComplete={() => setCart({})}
                />
              }
            />
            <Route path="/success" element={<OrderSuccessPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

function HomePage({ addToCart, cartCount }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const categories = ['All', ...new Set(PRODUCTS.map((product) => product.category))]

  const filtered = PRODUCTS.filter((product) => {
    const categoryMatch = category === 'All' || product.category === category
    const searchMatch = product.name
      .toLowerCase()
      .includes(search.trim().toLowerCase())
    return categoryMatch && searchMatch
  })

  return (
    <section className="page home-page" data-testid="home-page">
      <div className="hero-band">
        <p className="eyebrow">Tiny shop, big vibes</p>
        <h1>Shop your daily essentials with style.</h1>
        <p className="subtitle">
          Search, filter, and check out in a complete mini e-commerce flow.
        </p>
        <div className="hero-stat" data-testid="home-cart-summary">
          Items in cart: {cartCount}
        </div>
      </div>

      <div className="filters">
        <label htmlFor="search">Search</label>
        <input
          id="search"
          type="search"
          placeholder="Try: Watch"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          data-testid="search-input"
        />

        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          data-testid="category-filter"
        >
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="product-grid" data-testid="product-grid">
        {filtered.map((product) => (
          <article
            key={product.id}
            className="product-card"
            data-testid={`product-card-${product.id}`}
          >
            <img src={product.image} alt={product.name} />
            <div className="product-card-body">
              <p className="product-category">{product.category}</p>
              <h2>{product.name}</h2>
              <p>{product.description}</p>
              <div className="card-footer">
                <strong id={`price-${product.id}`}>{money.format(product.price)}</strong>
                <div className="card-actions">
                  <Link
                    to={`/product/${product.id}`}
                    data-testid={`view-product-${product.id}`}
                  >
                    More Details
                  </Link>
                  <button
                    type="button"
                    onClick={() => addToCart(product.id)}
                    data-testid={`add-to-cart-${product.id}`}
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProductPage({ addToCart }) {
  const { productId } = useParams()
  const product = PRODUCTS.find((item) => item.id === productId)

  if (!product) {
    return <Navigate to="/" replace />
  }

  return (
    <section className="page details-page" data-testid="product-details-page">
      <img src={product.image} alt={product.name} className="details-image" />
      <article className="details-copy" data-testid="product-detail-content">
        <p className="product-category">{product.category}</p>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
        <strong id={`price-${product.id}`}>{money.format(product.price)}</strong>
        <div className="details-actions">
          <button
            type="button"
            onClick={() => addToCart(product.id)}
            data-testid="add-to-cart-details"
          >
            Add to cart
          </button>
          <Link to="/cart" data-testid="go-to-cart-link">
            Go to cart
          </Link>
        </div>
      </article>
    </section>
  )
}

function CartPage({ cartItems, subtotal, removeFromCart, updateQuantity }) {
  return (
    <section className="page cart-page" data-testid="cart-page">
      <h1>Your Cart</h1>

      {cartItems.length === 0 ? (
        <div className="panel" data-testid="empty-cart">
          Cart is empty. Add something tasty from the home page.
        </div>
      ) : (
        <>
          <ul className="cart-list" data-testid="cart-item-list">
            {cartItems.map(({ product, quantity }) => (
              <li key={product.id} data-testid={`cart-item-${product.id}`}>
                <div>
                  <h2>{product.name}</h2>
                  <p>
                    <span id={`price-${product.id}`}>{money.format(product.price)}</span>{' '}each
                  </p>
                </div>

                <div className="quantity-controls">
                  <label htmlFor={`qty-${product.id}`}>Qty</label>
                  <input
                    id={`qty-${product.id}`}
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(event) =>
                      updateQuantity(product.id, event.target.value)
                    }
                    data-testid={`quantity-input-${product.id}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeFromCart(product.id)}
                    data-testid={`remove-item-${product.id}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="cart-summary panel">
            <p>
              Subtotal
              <strong data-testid="cart-subtotal">{money.format(subtotal)}</strong>
            </p>
            <Link to="/checkout" className="primary-link" data-testid="checkout-link">
              Go to checkout
            </Link>
          </div>
        </>
      )}
    </section>
  )
}

function CheckoutPage({ cartItems, subtotal, onCheckoutComplete }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')

  if (cartItems.length === 0) {
    return <Navigate to="/cart" replace />
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const orderId = `ORD-${Date.now().toString().slice(-6)}`
    onCheckoutComplete()
    navigate('/success', {
      state: {
        name,
        orderId,
        total: money.format(subtotal),
      },
    })
  }

  return (
    <section className="page checkout-page" data-testid="checkout-page">
      <h1>Checkout</h1>
      <form className="panel checkout-form" onSubmit={handleSubmit} data-testid="checkout-form">
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          data-testid="checkout-fullname"
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          data-testid="checkout-email"
        />

        <label htmlFor="address">Address</label>
        <textarea
          id="address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          rows="4"
          required
          data-testid="checkout-address"
        />

        <p className="checkout-total">
          Order total <strong data-testid="checkout-total">{money.format(subtotal)}</strong>
        </p>

        <button type="submit" data-testid="place-order-button">
          Place order
        </button>
      </form>
    </section>
  )
}

function OrderSuccessPage() {
  return (
    <section className="page success-page panel" data-testid="order-success-page">
      <h1>Order Confirmed</h1>
      <p data-testid="order-confirmation-message">
        Thank you. Your order has been placed successfully.
      </p>
      <Link to="/" className="primary-link" data-testid="continue-shopping-link">
        Continue shopping
      </Link>
    </section>
  )
}

export default App
