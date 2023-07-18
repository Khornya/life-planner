import renderer from 'react-test-renderer'

import Home from '@/pages/home'

describe('Home page', () => {
  it('should render the home page', () => {
    const tree = renderer.create(<Home />).toJSON()

    expect(tree).toMatchSnapshot()
  })
})
