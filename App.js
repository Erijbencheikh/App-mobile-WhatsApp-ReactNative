import { NavigationContainer } from '@react-navigation/native';
import Auth from './Screens/Auth.js';
import CreateUser from './Screens/CreateUser.js';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from './Screens/Home.js';
import Chat from './Screens/Home/Chat.js';
const stack= createNativeStackNavigator();

export default function App() {
  
  return <NavigationContainer>
   
   <stack.Navigator initialRouteName='CreateUser' screenOptions={{headerShown:false}}>
    <stack.Screen name='Auth' component={Auth}></stack.Screen>
    <stack.Screen name='CreateUser' component={CreateUser}></stack.Screen>
    <stack.Screen name='Home' component={Home}></stack.Screen>
    <stack.Screen name='Chat' component={Chat} options={{ headerShown: true }}></stack.Screen>
   </stack.Navigator>
  </NavigationContainer>;
}


