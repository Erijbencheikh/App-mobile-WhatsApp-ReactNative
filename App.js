import { NavigationContainer } from '@react-navigation/native';
import Auth from './Screens/Auth.js';
import CreateUser from './Screens/CreateUser.js';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from './Screens/Home.js';
import Chat from './Screens/Home/Chat.js';
import GroupChat from './Screens/Home/GroupChat.js';
import Account from './Screens/Home/Account.js';
const stack= createNativeStackNavigator();

export default function App() {
  
  return <NavigationContainer>
  
   <stack.Navigator initialRouteName='Auth' screenOptions={{headerShown:false}}>
    <stack.Screen name='Auth' component={Auth}></stack.Screen>
    <stack.Screen name='CreateUser' component={CreateUser}></stack.Screen>
    <stack.Screen name='Home' component={Home}></stack.Screen>
    <stack.Screen name='Chat' component={Chat} options={{ headerShown: true }}/>
    <stack.Screen name="GroupChat" component={GroupChat} options={{ headerShown: true }}/>
   </stack.Navigator>
  </NavigationContainer>;
}


