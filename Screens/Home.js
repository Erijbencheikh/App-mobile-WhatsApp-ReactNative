import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import List from "./Home/List";
import Account from "./Home/Account";
import GroupList from "./Home/GroupList";

const Tab = createBottomTabNavigator();

export default function Home(props) {
  //Get the current user ID passed from Auth.js
  const currentid=props.route.params.currentid;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;

          if (route.name === "List") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Group") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "Account") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >

      {/*Pass currentid to the screens so they know who is logged in*/}
      
      <Tab.Screen name="List"
      initialParams={{currentid:currentid}}
       component={List} />
      <Tab.Screen name="Group" 
      initialParams={{ currentid: currentid }}
      component={GroupList} />
      <Tab.Screen
      initialParams={{currentid:currentid}}
      name="Account" component={Account} />
    </Tab.Navigator>
  );
}
