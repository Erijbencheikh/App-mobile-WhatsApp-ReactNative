import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import List from "./Home/List";
import Group from "./Home/Group";
import Account from "./Home/Account";

const Tab = createBottomTabNavigator();

export default function Home(props) {
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
      <Tab.Screen name="List"
      initialParams={{currentid:currentid}}
       component={List} />
      <Tab.Screen name="Group" component={Group} />
      <Tab.Screen
      initialParams={{currentid:currentid}}
      name="Account" component={Account} />
    </Tab.Navigator>
  );
}
