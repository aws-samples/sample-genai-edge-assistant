import pathlib
import base64
import sagemaker
from sagemaker.predictor import Predictor
from pprint import pprint

def get_base64_from_image(image_path):
    with open(image_path, 'rb') as img_file:
        b64_bytes = base64.b64encode(img_file.read())
        b64_str = b64_bytes.decode('utf-8')
        return f"data:image/jpeg;base64,{b64_str}"

def test_navigation_endpoint(predictor):
    """Test navigation functionality"""
    print("=== TESTING NAVIGATION ===")
    
    HERE = pathlib.Path(__file__).parent
    navigation_input = {
        "pipeline_type": "navigation",
        "image": get_base64_from_image(HERE.parent / "data" / "samples" / "sidewalk.jpg"),
        "nav_goal": "sidewalk"
    }
    
    result = predictor.predict(navigation_input)
    print("Navigation result:")
    pprint(result)
    return result

def test_chat_endpoint(predictor):
    """Test chat functionality"""
    print("\n=== TESTING CHAT ===")
    
    HERE = pathlib.Path(__file__).parent
    chat_input = {
        "pipeline_type": "chat",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": get_base64_from_image(HERE.parent / "data" / "samples" / "sidewalk.jpg")},
                    {"type": "text", "text": "What do you see in this image?"}
                ]
            }
        ]
    }
    
    result = predictor.predict(chat_input)
    print("Chat result:")
    pprint(result)
    return result

if __name__ == "__main__":
    default_endpoint = "gemma3n-test-endpoint"
    endpoint_name = input(f"Endpoint name (press enter for '{default_endpoint}'): ").strip()
    if not endpoint_name:
        endpoint_name = default_endpoint
    
    print(f"Testing endpoint '{endpoint_name}'...")
    
    try:
        predictor = Predictor(endpoint_name)
        predictor.serializer = sagemaker.serializers.JSONSerializer()
        predictor.deserializer = sagemaker.deserializers.JSONDeserializer()
        
        # Test both use cases
        nav_result = test_navigation_endpoint(predictor)
        chat_result = test_chat_endpoint(predictor)
        
        print("\n✓ Both navigation and chat working on endpoint!")
        
        # Option to delete endpoint
        delete = input("\nDelete endpoint? [y/N]: ").lower() == 'y'
        if delete:
            print("Deleting endpoint...")
            predictor.delete_endpoint()
            print("✓ Endpoint deleted")
            
    except Exception as e:
        print(f"❌ Error testing endpoint: {str(e)}")
        print("Make sure the endpoint exists and is InService")